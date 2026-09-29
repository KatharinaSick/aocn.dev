terraform {
  required_version = "~> 1.12"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }

  backend "gcs" {
    bucket = "adventofcloudnative-tofu-state"
    prefix = "infra"
  }
}
