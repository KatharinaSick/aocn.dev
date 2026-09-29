# Defaulted rather than required: this configuration manages one project, and the
# backend block cannot reference variables anyway, so the project is already fixed.

variable "project_id" {
  description = "GCP project ID."
  type        = string
  default     = "adventofcloudnative"
}

variable "region" {
  description = "Region for Artifact Registry and Cloud Run."
  type        = string
  default     = "europe-west1"
}

variable "github_repository" {
  description = "Repository allowed to deploy, as owner/name."
  type        = string
  default     = "KatharinaSick/aocn.dev"
}
