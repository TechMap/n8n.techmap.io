import { NodeApiError, type IExecuteFunctions } from 'n8n-workflow';

import {
	buildRssFeedUrl,
	compactQuery,
	getJobId,
	techmapApiRequest,
	toIsoDate,
} from '../nodes/Techmap/GenericFunctions';
import { node } from './helpers';

describe('GenericFunctions', () => {
	it('compactQuery drops empty values and trims strings', () => {
		expect(compactQuery({ a: ' x ', b: '', c: '  ', d: undefined, e: 0, f: false })).toEqual({
			a: 'x',
			e: 0,
			f: false,
		});
	});

	it('buildRssFeedUrl encodes parameters', () => {
		const url = buildRssFeedUrl({ title: 'c++ developer', city: '' }, 'k&y');
		expect(url).toBe(
			'https://job-postings-rss-feed.p.rapidapi.com/api/rss/v1/jobs_full?title=c%2B%2B+developer&rapidapi-key=k%26y',
		);
	});

	it('getJobId prefers the JSON-LD identifier, then the URL', () => {
		expect(getJobId({ jsonLD: { identifier: 'abc', url: 'https://x' } })).toBe('abc');
		expect(getJobId({ jsonLD: { url: 'https://x' } })).toBe('https://x');
		expect(getJobId({})).toBeUndefined();
	});

	it('toIsoDate formats UTC dates', () => {
		expect(toIsoDate(new Date('2026-10-01T23:30:00Z'))).toBe('2026-10-01');
	});

	it('techmapApiRequest wraps request failures in NodeApiError', async () => {
		const context = {
			getNode: () => node,
			helpers: {
				httpRequestWithAuthentication: jest.fn().mockRejectedValue({
					message: 'Request failed with status code 429',
					httpCode: '429',
				}),
			},
		} as unknown as IExecuteFunctions;

		await expect(techmapApiRequest.call(context, '/api/v2/jobs/search')).rejects.toBeInstanceOf(
			NodeApiError,
		);
	});
});
