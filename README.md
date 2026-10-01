# n8n-nodes-techmap

This is an n8n community node. It lets you use the [Techmap](https://jobdatafeeds.com) job postings APIs in your n8n workflows.

Techmap collects about 8 million new job postings per month from 185 sources (company career pages and ATS platforms, job boards, aggregators and public employment offices) in 250 countries and territories. With this node you can search those postings by country, title, city, occupation, workplace type and date, generate RSS feed URLs for a search, and start workflows when new matching jobs appear.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Example workflow](#example-workflow)
- [Compatibility](#compatibility)
- [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

In short: in n8n go to **Settings > Community Nodes**, select **Install**, enter `n8n-nodes-techmap` and confirm.

For a self-hosted n8n you can also run `npm install n8n-nodes-techmap` in `~/.n8n/nodes` and restart n8n.

## Credentials

The node uses the **Techmap API** credential, which holds a RapidAPI key.

1. Create a free account on [RapidAPI](https://rapidapi.com).
2. Subscribe to the [Techmap Daily International Job Postings API](https://rapidapi.com/techmap-io-techmap-io-default/api/daily-international-job-postings). The free plan includes 1,000 job postings per month.
3. Optional: subscribe to the [Techmap Job Postings RSS Feed API](https://rapidapi.com/techmap-io-techmap-io-default/api/job-postings-rss-feed) if you want to use the RSS feed URLs.
4. Copy your application key (`X-RapidAPI-Key`) from the RapidAPI dashboard.
5. In n8n, create a new **Techmap API** credential and paste the key into **RapidAPI Key**.

The credential test calls the count endpoint of the Jobs API, which returns only a number and no job postings.

## Operations

### Techmap node

**Job > Search** searches job postings (`GET /api/v2/jobs/search`).

| Parameter | Description |
| --- | --- |
| Country Code | Two-letter ISO 3166-1 code, for example `us`, `de` or `gb` |
| Title | Free-text search in the job title |
| City | City of the workplace |
| Occupation | Occupation stem, for example `engineer`, `nurse` or `manager` |
| Work Place | Any, Remote, Hybrid, Onsite, Field or Offshore |
| Date Created | Day (`YYYY-MM-DD`) or month (`YYYY-MM`). If empty, the API uses today minus two days |
| Page | Result page, starting at 1. Each page holds up to 10 postings |
| Simplify | Return the most useful fields (title, company, location, workplace, date, `id`, `url`, `description`) instead of the full record |
| Additional Filters | Company, Contract Type, Exclude Duplicates, Has Salary, Industry, Language, Skills, State, Work Type |

Each job posting becomes one n8n item. Every returned posting counts towards your monthly quota.

**Job > Get RSS Feed URL** builds a URL for the Techmap RSS Feed API (`GET /api/rss/v1/jobs_full`) from the same filters plus **Page Size**. It does not call the API. If **Include API Key in URL** is on, your RapidAPI key is added as the `rapidapi-key` query parameter so that any RSS reader can fetch the feed. Treat such a URL like a password.

### Techmap Trigger node

**New Jobs** polls the Jobs API and starts the workflow for job postings that were not seen in earlier polls.

- Uses the same filters as the search operation.
- Searches postings created between today minus **Lookback Days** (default 2) and today, because postings are indexed with a short delay.
- Requests up to **Max Pages** pages of 10 postings per poll (default 1).
- The first poll after activation only records the current postings; later polls emit new ones. A manual test run shows sample data and does not change the stored state.

Each poll uses quota. With the free plan (1,000 postings per month) and Max Pages = 1, a poll every hour uses up to 7,200 postings per month, so poll every day or every few hours, or use a paid plan.

## Example workflow

Daily list of new remote data engineering jobs in Germany. Import it with **Workflow > Import from File/URL** or paste it into the editor, then select your Techmap API credential.

```json
{
  "name": "Techmap: daily remote data jobs in Germany",
  "nodes": [
    {
      "parameters": {
        "rule": { "interval": [{ "triggerAtHour": 7 }] }
      },
      "name": "Every morning",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [0, 0]
    },
    {
      "parameters": {
        "resource": "job",
        "operation": "search",
        "countryCode": "de",
        "title": "data engineer",
        "workPlace": "remote",
        "page": 1,
        "simplify": true,
        "additionalFilters": { "excludeDuplicates": true }
      },
      "name": "Search jobs",
      "type": "n8n-nodes-techmap.techmap",
      "typeVersion": 1,
      "position": [220, 0],
      "credentials": { "techmapApi": { "id": "", "name": "Techmap API account" } }
    }
  ],
  "connections": {
    "Every morning": { "main": [[{ "node": "Search jobs", "type": "main", "index": 0 }]] }
  }
}
```

Connect the output to Slack, Google Sheets, Airtable or any other node to share or store the postings.

## Compatibility

Built and tested with n8n-workflow 2.x and `@n8n/node-cli` 0.50. Requires an n8n version that supports community nodes (1.0 or later).

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Techmap API documentation](https://api.techmap.io)
- [Techmap job data feeds](https://jobdatafeeds.com)

## License

[MIT](LICENSE.md), Techmap GmbH
