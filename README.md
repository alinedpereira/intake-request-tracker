# Intake Request Tracker

A React, TypeScript, and Vite app for submitting and managing intake requests,
assignments, task progress, approvals, and request files. The app uses SharePoint
through a Power Platform data-source binding.

## Requirements

- Bun
- A Power Platform environment with the app's required SharePoint data-source
  binding and lists
- A SharePoint site and document library for request files

## Local configuration

Set these Vite environment variables for the SharePoint site used by your own
deployment. Do not commit tenant URLs, library IDs, credentials, or real request
data.

```text
VITE_SHAREPOINT_SITE_URL=https://<tenant>.sharepoint.com/sites/<site>
VITE_SHAREPOINT_DOCUMENTS_LIBRARY_ID=<document-library-id>
```

The generated client in `generated/` describes the app's connector operations;
the live Power Platform binding and authentication are supplied by the runtime,
not by these environment variables. The tenant-specific `ms.config.json` is not
included in this public source repository.

## Development

```sh
bun install
bun run dev
```

Run the project checks and production build with:

```sh
bun run check
bun run build
```

## Disclaimers

- This source is provided “as is,” without warranties or guarantees of any kind.
  It is not certified for production, security, privacy, regulatory, or records
  management requirements. Review and test it for your own environment before
  use.
- This project is an independent sample application and is not an official
  Microsoft product, nor is it endorsed or supported by Microsoft.
- You are responsible for configuring and securing your Power Platform and
  SharePoint resources, access controls, retention policies, and user consent.
  Do not publish secrets, tenant-specific configuration, customer information,
  or real request files.
- A public source repository is not a deployed or hosted application. Running
  this app requires compatible Power Platform runtime services, a configured
  data-source binding, and the SharePoint resources described above.
- No separate license grant is included in this repository. All rights remain
  with their respective owners unless otherwise stated.
