import type { IDataObject, INode } from 'n8n-workflow';

export const API_KEY = 'test-rapidapi-key';

export const node: INode = {
	id: 'node-id',
	name: 'Techmap',
	type: 'n8n-nodes-techmap.techmap',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

export function job(id: string, overrides: IDataObject = {}): IDataObject {
	return {
		title: `Job ${id}`,
		company: 'Example GmbH',
		city: 'Berlin',
		countryCode: 'de',
		workPlace: ['Remote'],
		dateCreated: '2026-09-29T01:22:18.000Z',
		portal: 'example',
		jsonLD: {
			identifier: id,
			url: `https://example.com/jobs/${id}`,
			description: `Description for ${id}`,
		},
		...overrides,
	};
}

export function searchResponse(result: IDataObject[], page = 1): IDataObject {
	return {
		api: 'Techmap.io Job Posting API',
		apiVersion: 'v2.6',
		page,
		pageSize: 10,
		totalCount: result.length,
		result,
	};
}

/**
 * Creates a parameter getter that mirrors n8n's getNodeParameter(name, [itemIndex], fallback).
 */
export function parameterGetter(params: IDataObject, hasItemIndex: boolean) {
	return jest.fn((name: string, ...rest: unknown[]) => {
		const fallback = hasItemIndex ? rest[1] : rest[0];
		return params[name] !== undefined ? params[name] : fallback;
	});
}

export const returnJsonArray = (data: IDataObject[]) => data.map((json) => ({ json }));
