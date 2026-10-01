import type { IDataObject, IDisplayOptions, INodeProperties } from 'n8n-workflow';

export const workPlaceOptions = [
	{ name: 'Any', value: '' },
	{ name: 'Field', value: 'field' },
	{ name: 'Hybrid', value: 'hybrid' },
	{ name: 'Offshore', value: 'offshore' },
	{ name: 'Onsite', value: 'onsite' },
	{ name: 'Remote', value: 'remote' },
];

/**
 * Main search filters shared by the Techmap node operations and the Techmap Trigger.
 */
export function mainFilterFields(show?: IDisplayOptions['show']): INodeProperties[] {
	const displayOptions = show ? { displayOptions: { show } } : {};
	return [
		{
			displayName: 'Country Code',
			name: 'countryCode',
			type: 'string',
			default: '',
			placeholder: 'us',
			description:
				'Two-letter ISO 3166-1 alpha-2 country code of the job location, e.g. <code>us</code>, <code>de</code> or <code>gb</code>',
			...displayOptions,
		},
		{
			displayName: 'Title',
			name: 'title',
			type: 'string',
			default: '',
			placeholder: 'data engineer',
			description: 'Free-text search within the job title',
			...displayOptions,
		},
		{
			displayName: 'City',
			name: 'city',
			type: 'string',
			default: '',
			placeholder: 'Berlin',
			description: 'City of the workplace',
			...displayOptions,
		},
		{
			displayName: 'Occupation',
			name: 'occupation',
			type: 'string',
			default: '',
			placeholder: 'engineer',
			description:
				'Occupation stem extracted from the job title, e.g. programmer, manager, engineer or nurse',
			...displayOptions,
		},
		{
			displayName: 'Work Place',
			name: 'workPlace',
			type: 'options',
			options: workPlaceOptions,
			default: '',
			description: 'Workplace type of the job',
			...displayOptions,
		},
	];
}

/**
 * Optional filters that are less frequently used.
 */
export function additionalFilterOptions(): INodeProperties[] {
	return [
		{
			displayName: 'Company',
			name: 'company',
			type: 'string',
			default: '',
			description: 'Company that posted the job (can be a recruiting firm)',
		},
		{
			displayName: 'Contract Type',
			name: 'contractType',
			type: 'string',
			default: '',
			placeholder: 'permanent',
			description: 'Employment contract type, e.g. permanent, temporary or internship',
		},
		{
			displayName: 'Exclude Duplicates',
			name: 'excludeDuplicates',
			type: 'boolean',
			default: false,
			description: 'Whether to exclude postings that are flagged as duplicates of another posting',
		},
		{
			displayName: 'Has Salary',
			name: 'hasSalary',
			type: 'boolean',
			default: false,
			description: 'Whether to return only postings that mention a salary',
		},
		{
			displayName: 'Industry',
			name: 'industry',
			type: 'string',
			default: '',
			description: 'Industry of the hiring company',
		},
		{
			displayName: 'Language',
			name: 'language',
			type: 'string',
			default: '',
			placeholder: 'en',
			description: 'Two-letter ISO 639-1 language code of the posting, e.g. <code>en</code>',
		},
		{
			displayName: 'Skills',
			name: 'skills',
			type: 'string',
			default: '',
			placeholder: 'python',
			description: 'Skills, keywords or tags associated with the posting',
		},
		{
			displayName: 'State',
			name: 'state',
			type: 'string',
			default: '',
			description: 'State or region of the workplace',
		},
		{
			displayName: 'Work Type',
			name: 'workType',
			type: 'string',
			default: '',
			placeholder: 'fulltime',
			description: 'Work duration type, e.g. fulltime, parttime or flextime',
		},
	];
}

/**
 * Maps the "Additional Filters" collection to API query parameters.
 */
export function additionalFiltersToQuery(filters: IDataObject): IDataObject {
	const query: IDataObject = {};
	for (const [key, value] of Object.entries(filters)) {
		if (key === 'excludeDuplicates') {
			if (value === true) query.IsDuplicate = 'false';
		} else if (key === 'hasSalary') {
			if (value === true) query.hasSalary = 'true';
		} else {
			query[key] = value;
		}
	}
	return query;
}

const SIMPLE_FIELDS = [
	'title',
	'company',
	'city',
	'state',
	'countryCode',
	'workPlace',
	'workType',
	'contractType',
	'occupation',
	'industry',
	'language',
	'dateCreated',
];

/**
 * Reduces a job posting to the most useful fields.
 */
export function simplifyJob(job: IDataObject): IDataObject {
	const simple: IDataObject = {};
	for (const field of SIMPLE_FIELDS) {
		if (job[field] !== undefined) simple[field] = job[field];
	}
	const jsonLD = (job.jsonLD ?? {}) as IDataObject;
	if (jsonLD.identifier !== undefined) simple.id = jsonLD.identifier;
	if (jsonLD.url !== undefined) simple.url = jsonLD.url;
	if (jsonLD.description !== undefined) simple.description = jsonLD.description;
	return simple;
}
