import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TechmapApi implements ICredentialType {
	name = 'techmapApi';

	displayName = 'Techmap API';

	icon: Icon = { light: 'file:../icons/techmap.svg', dark: 'file:../icons/techmap.dark.svg' };

	documentationUrl = 'https://github.com/TechMap/n8n.techmap.io?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'RapidAPI Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your RapidAPI application key. Subscribe to the Techmap Jobs API on RapidAPI (free plan: 1,000 job postings per month) and copy the X-RapidAPI-Key value.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-RapidAPI-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	// The count endpoint returns only a number, so testing the key does not use up job postings.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://daily-international-job-postings.p.rapidapi.com',
			url: '/api/v2/jobs/count',
			method: 'GET',
			headers: {
				'X-RapidAPI-Host': 'daily-international-job-postings.p.rapidapi.com',
			},
			qs: {
				countryCode: 'lu',
			},
		},
	};
}
