# Security maintenance

Use Node.js 24.22.1 or a newer patched 24.x release and the pinned pnpm version.
Run `pnpm audit` for the complete dependency report. CI checks all severities,
with the following explicit exceptions because no patched npm release exists
as of 2026-10-22. Exceptions are not declarations that the packages are safe.

- **GHSA-vfj7-8cjw-p6xm / braces <=3.0.3:** recursive brace patterns can exhaust
  the stack. This is a build-tool dependency. Do not process untrusted glob
  patterns. Remove the CI exception once an upstream fixed release is available.
  https://github.com/micromatch/braces/issues/70

The Sanity runtime CLI remains pinned to the existing compatible 17.4.0 while
updating vulnerable transitive packages. Newer CLI resolution currently requests
an unavailable Blueprints dependency from the package-manager registry metadata.
Validate schema extraction, generated types, all workspace builds, and route
checks before changing the Sanity toolchain.
