package queue

import (
	"encoding/json"
)

const (
	TaskBuildDeploy   = "build_deploy"
	TaskApplySettings = "apply_settings"
	TaskSelfUpdate    = "self_update"
)

type BuildDeployPayload struct {
	DeploymentID string `json:"deployment_id"`
}

type AdminJobPayload struct {
	JobID string `json:"job_id"`
}

func MustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}
