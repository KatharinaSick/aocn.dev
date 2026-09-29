# Infrastructure

The GCP platform the API runs on, managed with [OpenTofu](https://opentofu.org).

OpenTofu comes from devbox, so run these inside `devbox shell` — a system-wide `tofu` is likely
older than the `required_version` this configuration pins.

```sh
tofu init
tofu plan
tofu apply
```

Authentication is Application Default Credentials: `gcloud auth application-default login`.

## Not managed here

- **The project**, because it is tied to billing.
- **Container images and Cloud Run revisions**, which the deploy workflow will own. Having both
  manage them would mean every plan proposed reverting the other.
- **Secret values.** OpenTofu writes everything it knows to state, so secrets are created
  empty and filled in separately:

  ```sh
  printf '%s' 'Authorization=Api-Token dt0c01.XXXX' \
    | gcloud secrets versions add dynatrace-otlp-token --data-file=-
  ```

## Bootstrapping

Already done for `adventofcloudnative`. Kept because a configuration that cannot be stood up from
scratch is a configuration nobody can recreate.

Two things have to exist before OpenTofu can run at all:

- **The state bucket.** The backend stores state in the same bucket this configuration declares, so
  `tofu init` fails until it exists.
- **`cloudresourcemanager` and `serviceusage`.** They are what `google_project_service` calls to
  enable everything else, including itself.

```sh
gcloud config set project adventofcloudnative
gcloud auth application-default login

gcloud services enable cloudresourcemanager.googleapis.com serviceusage.googleapis.com

gcloud storage buckets create gs://adventofcloudnative-tofu-state \
  --location=europe-west1 \
  --uniform-bucket-level-access \
  --public-access-prevention
gcloud storage buckets update gs://adventofcloudnative-tofu-state --versioning
```

The bucket now exists but is not in state, and creating it a second time fails. Adopt it, then
apply normally — the apply is what puts the lifecycle rule and the rest of the configuration on it:

```sh
tofu init
tofu import google_storage_bucket.state adventofcloudnative/adventofcloudnative-tofu-state
tofu apply
```

Enabling the two APIs by hand needs no import: `google_project_service` adopts a service that is
already on.

## GitHub Actions variables

The workflows read their identities from Actions variables rather than hardcoding them. None of
these are confidential — a service account email and a provider path grant nothing on their own,
because impersonation is gated on the OIDC `ref` claim, not on knowing the name. They are variables
rather than secrets for that reason: they are configuration, not credentials.

They are kept out of the workflow files anyway, so the GCP project number stays out of a public
repository and the workflows name no particular environment.

```sh
gh variable set WIF_PROVIDER   --body "$(tofu output -raw wif_provider)"
gh variable set SA_INFRA_PLAN  --body "$(tofu output -raw infra_plan_service_account)"
gh variable set SA_INFRA_APPLY --body "$(tofu output -raw infra_apply_service_account)"
```

`deployer_service_account` gets the same treatment once the deploy workflow exists.
