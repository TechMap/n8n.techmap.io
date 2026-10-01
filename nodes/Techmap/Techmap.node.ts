import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import {
	additionalFilterOptions,
	additionalFiltersToQuery,
	mainFilterFields,
	simplifyJob,
} from './descriptions';
import {
	buildRssFeedUrl,
	compactQuery,
	JOBS_SEARCH_PATH,
	techmapApiRequest,
} from './GenericFunctions';

const DATE_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/;

export class Techmap implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Techmap',
		name: 'techmap',
		icon: { light: 'file:../../icons/techmap.svg', dark: 'file:../../icons/techmap.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Search daily international job postings with the Techmap Jobs API',
		defaults: {
			name: 'Techmap',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'techmapApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Job',
						value: 'job',
					},
				],
				default: 'job',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['job'],
					},
				},
				options: [
					{
						name: 'Get RSS Feed URL',
						value: 'getRssFeedUrl',
						description: 'Build an RSS 2.0 feed URL for a job search',
						action: 'Get RSS feed URL',
					},
					{
						name: 'Search',
						value: 'search',
						description: 'Search job postings',
						action: 'Search jobs',
					},
				],
				default: 'search',
			},

			// ----------------------------------
			//         job: search
			// ----------------------------------
			...mainFilterFields({ resource: ['job'], operation: ['search'] }),
			{
				displayName: 'Date Created',
				name: 'dateCreated',
				type: 'string',
				default: '',
				placeholder: '2026-09-29',
				description:
					'Day (<code>YYYY-MM-DD</code>) or month (<code>YYYY-MM</code>) the job was posted. If empty, the API uses the current day minus two days.',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{
						name: 'Newest First',
						value: 'newest',
						description: 'Most recently collected job postings first',
					},
					{
						name: 'Oldest First',
						value: 'oldest',
						description: 'Stable order for paging through all results',
					},
				],
				default: 'newest',
				description: 'Order of the results by the time the job posting was collected',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description:
					'Page of the results, starting at 1. Each page contains up to 10 job postings and counts towards your monthly quota.',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of each job posting instead of the raw data',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Additional Filters',
				name: 'additionalFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['search'],
					},
				},
				options: additionalFilterOptions(),
			},

			// ----------------------------------
			//         job: getRssFeedUrl
			// ----------------------------------
			...mainFilterFields({ resource: ['job'], operation: ['getRssFeedUrl'] }),
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 1000,
				},
				default: 10,
				description:
					'Number of job postings per feed request. The maximum depends on your RSS API plan.',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['getRssFeedUrl'],
					},
				},
			},
			{
				displayName: 'Include API Key in URL',
				name: 'includeApiKey',
				type: 'boolean',
				default: true,
				description:
					'Whether to add your RapidAPI key as the <code>rapidapi-key</code> query parameter so that RSS readers can fetch the feed. Treat such a URL like a password.',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['getRssFeedUrl'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const query: IDataObject = {
					countryCode: this.getNodeParameter('countryCode', i, '') as string,
					title: this.getNodeParameter('title', i, '') as string,
					city: this.getNodeParameter('city', i, '') as string,
					occupation: this.getNodeParameter('occupation', i, '') as string,
					workPlace: this.getNodeParameter('workPlace', i, '') as string,
				};

				if (operation === 'search') {
					const dateCreated = (this.getNodeParameter('dateCreated', i, '') as string).trim();
					if (dateCreated && !DATE_PATTERN.test(dateCreated)) {
						throw new NodeOperationError(
							this.getNode(),
							`Invalid "Date Created" value "${dateCreated}". Use YYYY-MM-DD or YYYY-MM.`,
							{ itemIndex: i },
						);
					}
					const filters = this.getNodeParameter('additionalFilters', i, {}) as IDataObject;
					const qs = compactQuery({
						...query,
						...additionalFiltersToQuery(filters),
						dateCreated,
						sort: this.getNodeParameter('sort', i, 'newest') as string,
						page: this.getNodeParameter('page', i, 1) as number,
					});
					const response = await techmapApiRequest.call(this, JOBS_SEARCH_PATH, qs);
					const simplify = this.getNodeParameter('simplify', i, true) as boolean;
					const jobs = Array.isArray(response.result) ? (response.result as IDataObject[]) : [];
					for (const job of jobs) {
						returnData.push({
							json: simplify ? simplifyJob(job) : job,
							pairedItem: { item: i },
						});
					}
				} else if (operation === 'getRssFeedUrl') {
					const includeApiKey = this.getNodeParameter('includeApiKey', i, true) as boolean;
					let apiKey: string | undefined;
					if (includeApiKey) {
						const credentials = await this.getCredentials('techmapApi');
						apiKey = credentials.apiKey as string;
					}
					const pageSize = this.getNodeParameter('pageSize', i, 10) as number;
					const url = buildRssFeedUrl({ ...query, pageSize }, apiKey);
					returnData.push({
						json: {
							url,
							includesApiKey: includeApiKey,
							documentation: 'https://api.techmap.io',
						},
						pairedItem: { item: i },
					});
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, {
						itemIndex: i,
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
