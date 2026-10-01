import {
	NodeConnectionTypes,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

import {
	additionalFilterOptions,
	additionalFiltersToQuery,
	mainFilterFields,
	simplifyJob,
} from '../Techmap/descriptions';
import {
	compactQuery,
	getJobId,
	JOBS_SEARCH_PATH,
	techmapApiRequest,
	toIsoDate,
} from '../Techmap/GenericFunctions';

const MAX_REMEMBERED_IDS = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface TriggerState {
	seenIds?: string[];
}

export class TechmapTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Techmap Trigger',
		name: 'techmapTrigger',
		icon: { light: 'file:../../icons/techmap.svg', dark: 'file:../../icons/techmap.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: 'New Jobs',
		description: 'Starts the workflow when new job postings match your search',
		defaults: {
			name: 'Techmap Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'techmapApi',
				required: true,
			},
		],
		properties: [
			{
				displayName:
					'Every poll requests up to "Max Pages" × 10 job postings, which count towards your monthly RapidAPI quota (free plan: 1,000 postings). A daily or hourly poll is usually enough.',
				name: 'quotaNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'New Jobs',
						value: 'newJobs',
						description: 'Trigger on job postings that were not seen in previous polls',
					},
				],
				default: 'newJobs',
			},
			...mainFilterFields(),
			{
				displayName: 'Lookback Days',
				name: 'lookbackDays',
				type: 'number',
				typeOptions: {
					minValue: 0,
					maxValue: 14,
				},
				default: 2,
				description:
					'How many days back from today to search by date created. Postings are indexed with a short delay, so a value of 1–2 avoids missing jobs.',
			},
			{
				displayName: 'Max Pages',
				name: 'maxPages',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 20,
				},
				default: 1,
				description: 'Maximum number of result pages (10 postings each) to request per poll',
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of each job posting instead of the raw data',
			},
			{
				displayName: 'Additional Filters',
				name: 'additionalFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				options: additionalFilterOptions(),
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const state = this.getWorkflowStaticData('node') as TriggerState;
		const isManual = this.getMode() === 'manual';
		const isFirstRun = !Array.isArray(state.seenIds);
		const seenIds = new Set<string>(state.seenIds ?? []);

		const lookbackDays = this.getNodeParameter('lookbackDays', 2) as number;
		const maxPages = this.getNodeParameter('maxPages', 1) as number;
		const simplify = this.getNodeParameter('simplify', true) as boolean;
		const filters = this.getNodeParameter('additionalFilters', {}) as IDataObject;

		const now = new Date();
		const baseQuery = compactQuery({
			countryCode: this.getNodeParameter('countryCode', '') as string,
			title: this.getNodeParameter('title', '') as string,
			city: this.getNodeParameter('city', '') as string,
			occupation: this.getNodeParameter('occupation', '') as string,
			workPlace: this.getNodeParameter('workPlace', '') as string,
			...additionalFiltersToQuery(filters),
			dateCreatedMin: toIsoDate(new Date(now.getTime() - lookbackDays * DAY_MS)),
			dateCreatedMax: toIsoDate(now),
			// Newest first, so the first pages always contain the latest postings.
			sort: 'newest',
		});

		const pagesToFetch = isManual ? 1 : maxPages;
		const newJobs: IDataObject[] = [];
		const allJobs: IDataObject[] = [];

		for (let page = 1; page <= pagesToFetch; page++) {
			const response = await techmapApiRequest.call(this, JOBS_SEARCH_PATH, {
				...baseQuery,
				page,
			});
			const jobs = Array.isArray(response.result) ? (response.result as IDataObject[]) : [];
			for (const job of jobs) {
				allJobs.push(job);
				const id = getJobId(job);
				if (id === undefined) continue;
				if (!seenIds.has(id)) {
					seenIds.add(id);
					newJobs.push(job);
				}
			}
			if (jobs.length < 10) break;
		}

		if (isManual) {
			// Manual test runs show sample data but do not change the stored state.
			if (allJobs.length === 0) return null;
			return [
				this.helpers.returnJsonArray(allJobs.map((job) => (simplify ? simplifyJob(job) : job))),
			];
		}

		const ids = Array.from(seenIds);
		state.seenIds = ids.slice(Math.max(0, ids.length - MAX_REMEMBERED_IDS));

		// The first activated poll only records what already exists, so the workflow
		// starts with jobs that appear after activation.
		if (isFirstRun || newJobs.length === 0) return null;

		return [
			this.helpers.returnJsonArray(newJobs.map((job) => (simplify ? simplifyJob(job) : job))),
		];
	}
}
