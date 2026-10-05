# Scratch Runtime

Standalone static runtime for the Scratch editor embedded by Project LAB. It is served from a
dedicated HTTPS origin; authentication and project persistence stay in the LMS. This repository
contains only the runtime application, its build configuration, dependency lockfile, and required
license notices. It does not contain LMS source code or credentials.

## License and source offer

This application includes Scratch GUI, VM, and storage packages under AGPL-3.0-only. The matching
license text, Scratch trademark notice, upstream notices, the bundled third-party license texts,
and a versioned inventory of direct and transitive dependencies are included here. The running
editor links to the exact public commit used to build it.

Build a production artifact only after pushing the source to a public repository. Set
`VITE_SOURCE_REVISION` to that exact commit's 40-character SHA and set
`VITE_SOURCE_OFFER_URL` to a public URL containing the same SHA. The build fails if either value
is missing or invalid.

## Production build

Use Node.js 24 or newer and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
VITE_ALLOWED_HOST_ORIGINS=https://lms.algorithmicsespana.com \
VITE_SOURCE_REVISION=<public-source-commit-sha> \
VITE_SOURCE_OFFER_URL=https://github.com/AlgorithmicsSpain/scratch-runtime/tree/<public-source-commit-sha> \
pnpm build
```

On Windows PowerShell, set the three environment variables before running `pnpm build`.
The `dist/` directory is a static site; deploy its contents to a dedicated HTTPS virtual host,
not to the authenticated LMS origin. See [`deployment/plesk.md`](./deployment/plesk.md) for the
DNS, Plesk, TLS, and response-header configuration.

## Runtime protocol

The LMS initializes the iframe with a versioned `HOST_INIT` message. The runtime validates the
host origin, parent window, channel, message schema, and project size before loading a project.
Project bytes are returned to the authenticated host through `PROJECT_SAVE`; this runtime never
receives LMS credentials or accesses the LMS API.
