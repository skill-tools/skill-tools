---
name: deploy-vercel
description: Deploy web applications to Vercel. Use when the user wants to deploy, publish, or ship a web app to Vercel hosting.
version: 1.0.0
---

# Deploy to Vercel

Deploy your web application to Vercel with zero configuration.

## Prerequisites

- Vercel CLI installed (`npm i -g vercel`)
- Authenticated with `vercel login`

## Steps

1. Run `vercel` in the project root
2. Follow the prompts to link your project
3. Verify deployment at the provided URL

## Error Handling

- **Authentication failed**: Run `vercel login` again
- **Build failed**: Check the build logs with `vercel logs`
