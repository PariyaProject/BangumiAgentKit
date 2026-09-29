# Live public API probes

`pnpm smoke:public:online` runs the selected read-only Bangumi API probes. The default set includes profile and collection tools, so provide a public Bangumi username explicitly:

```sh
BANGUMI_PUBLIC_PROBE_USERNAME=<public-profile-name> pnpm smoke:public:online
```

The probe does not authenticate or write to Bangumi. It omits the supplied username from both the saved JSON report and stdout; the recorded inputs therefore do not reproduce account-scoped calls. To avoid account-scoped probes, select only the desired tools with repeated `--tool <exact-tool-name>` arguments:

```sh
pnpm smoke:public:online -- --tool bangumi.get_calendar
```
