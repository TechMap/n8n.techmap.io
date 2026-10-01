import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const JOBS_API_HOST = 'daily-international-job-postings.p.rapidapi.com';
export const RSS_API_HOST = 'job-postings-rss-feed.p.rapidapi.com';
export const JOBS_SEARCH_PATH = '/api/v2/jobs/search';
export const RSS_FEED_PATH = '/api/rss/v1/jobs_full';

type TechmapContext = IExecuteFunctions | IPollFunctions | ILoadOptionsFunctions;

/**
 * Calls the Techmap Jobs API on RapidAPI. The credential adds the X-RapidAPI-Key header.
 */
export async function techmapApiRequest(
	this: TechmapContext,
	path: string,
	qs: IDataObject = {},
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method: 'GET',
		url: `https://${JOBS_API_HOST}${path}`,
		headers: {
			Accept: 'application/json',
			'X-RapidAPI-Host': JOBS_API_HOST,
		},
		qs,
		json: true,
	};

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'techmapApi',
			options,
		)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Drops empty values so that only filters the user actually set are sent to the API.
 */
export function compactQuery(query: IDataObject): IDataObject {
	const result: IDataObject = {};
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null) continue;
		if (typeof value === 'string' && value.trim() === '') continue;
		result[key] = typeof value === 'string' ? value.trim() : value;
	}
	return result;
}

/**
 * Builds a ready-to-use RSS 2.0 feed URL for the Techmap RSS API. The RapidAPI key is passed
 * as the `rapidapi-key` query parameter so that RSS readers can fetch the feed without headers.
 */
export function buildRssFeedUrl(query: IDataObject, apiKey?: string): string {
	const url = new URL(`https://${RSS_API_HOST}${RSS_FEED_PATH}`);
	for (const [key, value] of Object.entries(compactQuery(query))) {
		url.searchParams.set(key, String(value));
	}
	if (apiKey) url.searchParams.set('rapidapi-key', apiKey);
	return url.toString();
}

/**
 * Returns a stable identifier for a job posting (used for de-duplication in the trigger).
 */
export function getJobId(job: IDataObject): string | undefined {
	const jsonLD = (job.jsonLD ?? {}) as IDataObject;
	const id = jsonLD.identifier ?? jsonLD.url ?? job.url;
	return id === undefined || id === null ? undefined : String(id);
}

/**
 * Formats a date as YYYY-MM-DD in UTC.
 */
export function toIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
