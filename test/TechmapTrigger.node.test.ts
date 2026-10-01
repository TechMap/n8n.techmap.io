import type { IDataObject, IPollFunctions } from 'n8n-workflow';

import { TechmapTrigger } from '../nodes/TechmapTrigger/TechmapTrigger.node';
import { job, node, parameterGetter, returnJsonArray, searchResponse } from './helpers';

function createContext(
	params: IDataObject,
	http: jest.Mock,
	staticData: IDataObject,
	mode: 'manual' | 'trigger' = 'trigger',
) {
	return {
		getNodeParameter: parameterGetter(params, false),
		getNode: () => node,
		getMode: () => mode,
		getWorkflowStaticData: () => staticData,
		helpers: {
			httpRequestWithAuthentication: http,
			returnJsonArray,
		},
	} as unknown as IPollFunctions;
}

describe('Techmap Trigger', () => {
	const trigger = new TechmapTrigger();

	beforeAll(() => {
		jest.useFakeTimers({ now: new Date('2026-10-01T08:00:00Z') });
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	it('queries the date window and records existing jobs on the first poll', async () => {
		const staticData: IDataObject = {};
		const http = jest.fn().mockResolvedValue(searchResponse([job('a'), job('b')]));
		const context = createContext({ countryCode: 'de', lookbackDays: 2 }, http, staticData);

		const result = await trigger.poll.call(context);

		expect(result).toBeNull();
		expect(staticData.seenIds).toEqual(['a', 'b']);
		expect(http.mock.calls[0][1].qs).toEqual({
			countryCode: 'de',
			dateCreatedMin: '2026-09-29',
			dateCreatedMax: '2026-10-01',
			sort: 'newest',
			page: 1,
		});
	});

	it('emits only jobs that were not seen before', async () => {
		const staticData: IDataObject = { seenIds: ['a', 'b'] };
		const http = jest.fn().mockResolvedValue(searchResponse([job('a'), job('c')]));
		const context = createContext({}, http, staticData);

		const result = await trigger.poll.call(context);

		expect(result).not.toBeNull();
		expect(result![0].map((item) => item.json.id)).toEqual(['c']);
		expect(staticData.seenIds).toEqual(['a', 'b', 'c']);
	});

	it('returns null when nothing new was found', async () => {
		const staticData: IDataObject = { seenIds: ['a'] };
		const http = jest.fn().mockResolvedValue(searchResponse([job('a')]));

		expect(await trigger.poll.call(createContext({}, http, staticData))).toBeNull();
	});

	it('follows pages up to Max Pages while pages are full', async () => {
		const fullPage = (prefix: string) =>
			searchResponse(Array.from({ length: 10 }, (_, i) => job(`${prefix}${i}`)));
		const http = jest
			.fn()
			.mockResolvedValueOnce(fullPage('p1-'))
			.mockResolvedValueOnce(fullPage('p2-'))
			.mockResolvedValueOnce(fullPage('p3-'));
		const staticData: IDataObject = { seenIds: [] };

		const result = await trigger.poll.call(createContext({ maxPages: 2 }, http, staticData));

		expect(http).toHaveBeenCalledTimes(2);
		expect(http.mock.calls[1][1].qs.page).toBe(2);
		expect(result![0]).toHaveLength(20);
	});

	it('returns sample data in manual mode without changing state', async () => {
		const staticData: IDataObject = { seenIds: ['a'] };
		const http = jest.fn().mockResolvedValue(searchResponse([job('a')]));

		const result = await trigger.poll.call(
			createContext({ simplify: false, maxPages: 5 }, http, staticData, 'manual'),
		);

		expect(http).toHaveBeenCalledTimes(1);
		expect((result![0][0].json.jsonLD as IDataObject).identifier).toBe('a');
		expect(staticData.seenIds).toEqual(['a']);
	});
});
