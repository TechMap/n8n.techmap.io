import { NodeOperationError, type IDataObject, type IExecuteFunctions } from 'n8n-workflow';

import { Techmap } from '../nodes/Techmap/Techmap.node';
import { API_KEY, job, node, parameterGetter, searchResponse } from './helpers';

function createContext(params: IDataObject, http: jest.Mock, continueOnFail = false) {
	const context = {
		getInputData: () => [{ json: {} }],
		getNodeParameter: parameterGetter(params, true),
		getNode: () => node,
		getCredentials: jest.fn(async () => ({ apiKey: API_KEY })),
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequestWithAuthentication: http,
		},
	};
	return context as unknown as IExecuteFunctions & { getCredentials: jest.Mock };
}

describe('Techmap node', () => {
	const techmap = new Techmap();

	it('describes the search and RSS operations', () => {
		const operation = techmap.description.properties.find((p) => p.name === 'operation');
		const values = (operation?.options as Array<{ value: string }>).map((o) => o.value);
		expect(values).toEqual(expect.arrayContaining(['search', 'getRssFeedUrl']));
		expect(techmap.description.credentials?.[0].name).toBe('techmapApi');
	});

	describe('search', () => {
		it('sends only the filters that are set and returns one item per job', async () => {
			const http = jest.fn().mockResolvedValue(searchResponse([job('a'), job('b')]));
			const context = createContext(
				{
					resource: 'job',
					operation: 'search',
					countryCode: ' de ',
					title: 'engineer',
					city: '',
					occupation: '',
					workPlace: 'remote',
					dateCreated: '2026-09-29',
					page: 2,
					simplify: true,
					additionalFilters: { company: 'Example', excludeDuplicates: true, hasSalary: false },
				},
				http,
			);

			const [items] = await techmap.execute.call(context);

			expect(http).toHaveBeenCalledTimes(1);
			const [credentialType, options] = http.mock.calls[0];
			expect(credentialType).toBe('techmapApi');
			expect(options.method).toBe('GET');
			expect(options.url).toBe(
				'https://daily-international-job-postings.p.rapidapi.com/api/v2/jobs/search',
			);
			expect(options.headers['X-RapidAPI-Host']).toBe(
				'daily-international-job-postings.p.rapidapi.com',
			);
			expect(options.qs).toEqual({
				countryCode: 'de',
				title: 'engineer',
				workPlace: 'remote',
				dateCreated: '2026-09-29',
				page: 2,
				company: 'Example',
				IsDuplicate: 'false',
			});

			expect(items).toHaveLength(2);
			expect(items[0].json).toEqual({
				title: 'Job a',
				company: 'Example GmbH',
				city: 'Berlin',
				countryCode: 'de',
				workPlace: ['Remote'],
				dateCreated: '2026-09-29T01:22:18.000Z',
				id: 'a',
				url: 'https://example.com/jobs/a',
				description: 'Description for a',
			});
			expect(items[0].pairedItem).toEqual({ item: 0 });
		});

		it('returns raw postings when simplify is off', async () => {
			const http = jest.fn().mockResolvedValue(searchResponse([job('a')]));
			const context = createContext({ operation: 'search', simplify: false }, http);

			const [items] = await techmap.execute.call(context);

			expect(items[0].json.portal).toBe('example');
			expect((items[0].json.jsonLD as IDataObject).identifier).toBe('a');
		});

		it('returns no items for an empty result', async () => {
			const http = jest.fn().mockResolvedValue(searchResponse([]));
			const [items] = await techmap.execute.call(createContext({ operation: 'search' }, http));
			expect(items).toEqual([]);
		});

		it('rejects an invalid date before calling the API', async () => {
			const http = jest.fn();
			const context = createContext({ operation: 'search', dateCreated: '29.09.2026' }, http);

			await expect(techmap.execute.call(context)).rejects.toThrow(/Invalid "Date Created"/);
			expect(http).not.toHaveBeenCalled();
		});

		it('surfaces HTTP errors as node errors', async () => {
			const http = jest.fn().mockRejectedValue({
				message: 'Request failed with status code 403',
				httpCode: '403',
			});
			const context = createContext({ operation: 'search' }, http);

			await expect(techmap.execute.call(context)).rejects.toBeInstanceOf(NodeOperationError);
			await expect(techmap.execute.call(context)).rejects.toThrow(/403|permission|Forbidden/i);
		});

		it('returns the error as an item when continue on fail is enabled', async () => {
			const http = jest.fn().mockRejectedValue(new Error('boom'));
			const context = createContext({ operation: 'search' }, http, true);

			const [items] = await techmap.execute.call(context);

			expect(items).toHaveLength(1);
			expect(items[0].json.error).toBeDefined();
		});
	});

	describe('getRssFeedUrl', () => {
		it('builds a feed URL with filters and the API key without calling the API', async () => {
			const http = jest.fn();
			const context = createContext(
				{
					operation: 'getRssFeedUrl',
					countryCode: 'us',
					title: 'nurse',
					workPlace: '',
					pageSize: 25,
					includeApiKey: true,
				},
				http,
			);

			const [items] = await techmap.execute.call(context);

			expect(http).not.toHaveBeenCalled();
			const url = new URL(items[0].json.url as string);
			expect(url.origin + url.pathname).toBe(
				'https://job-postings-rss-feed.p.rapidapi.com/api/rss/v1/jobs_full',
			);
			expect(Object.fromEntries(url.searchParams)).toEqual({
				countryCode: 'us',
				title: 'nurse',
				pageSize: '25',
				'rapidapi-key': API_KEY,
			});
			expect(items[0].json.includesApiKey).toBe(true);
		});

		it('omits the API key when requested', async () => {
			const context = createContext(
				{ operation: 'getRssFeedUrl', countryCode: 'de', includeApiKey: false },
				jest.fn(),
			);

			const [items] = await techmap.execute.call(context);

			expect(items[0].json.url).not.toContain('rapidapi-key');
			expect(context.getCredentials).not.toHaveBeenCalled();
		});
	});
});
