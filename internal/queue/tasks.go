package queue

import (
	"encoding/json"
)

const (
	TaskBuildDeploy = "build_deploy"
)

type BuildDeployPayload struct {
	DeploymentID string `json:"deployment_id"`
}

func MustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}

