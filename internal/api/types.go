package api

import (
	"time"

	"github.com/opencel/opencel/internal/db"
)

type projectResp struct {
	ID                     string    `json:"id"`
	OrgID                  string    `json:"org_id"`
	Slug                   string    `json:"slug"`
	RepoFullName           string    `json:"repo_full_name"`
	GitHubInstallationID   *int64    `json:"github_installation_id,omitempty"`
	GitHubDefaultBranch    *string   `json:"github_default_branch,omitempty"`
	ProductionDeploymentID *string   `json:"production_deployment_id,omitempty"`
	CreatedAt              time.Time `json:"created_at"`
}

func toProjectResp(p *db.Project) projectResp {
	var inst *int64
	if p.GitHubInstallationID.Valid {
		v := p.GitHubInstallationID.Int64
		inst = &v
	}
	var def *string
	if p.GitHubDefaultBranch.Valid {
		v := p.GitHubDefaultBranch.String
		def = &v
	}
	var prod *string
	if p.ProductionDeploymentID.Valid {
		v := p.ProductionDeploymentID.String
		prod = &v
	}
	return projectResp{
		ID:                     p.ID,
		OrgID:                  p.OrgID,
		Slug:                   p.Slug,
		RepoFullName:           p.RepoFullName,
		GitHubInstallationID:   inst,
		GitHubDefaultBranch:    def,
		ProductionDeploymentID: prod,
		CreatedAt:              p.CreatedAt,
	}
}

type deploymentResp struct {
	ID            string     `json:"id"`
	ProjectID     string     `json:"project_id"`
	GitSHA        string     `json:"git_sha"`
	GitRef        string     `json:"git_ref"`
	Type          string     `json:"type"`
	Status        string     `json:"status"`
	ImageRef      *string    `json:"image_ref,omitempty"`
	ContainerName *string    `json:"container_name,omitempty"`
	ServicePort   int        `json:"service_port"`
	PreviewURL    *string    `json:"preview_url,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	PromotedAt    *time.Time `json:"promoted_at,omitempty"`
}

func toDeploymentResp(d *db.Deployment) deploymentResp {
	var img *string
	if d.ImageRef.Valid {
		v := d.ImageRef.String
		img = &v
	}
	var cn *string
	if d.ContainerName.Valid {
		v := d.ContainerName.String
		cn = &v
	}
	var pu *string
	if d.PreviewURL.Valid {
		v := d.PreviewURL.String
		pu = &v
	}
	var pr *time.Time
	if d.PromotedAt.Valid {
		v := d.PromotedAt.Time
		pr = &v
	}
	return deploymentResp{
		ID:            d.ID,
		ProjectID:     d.ProjectID,
		GitSHA:        d.GitSHA,
		GitRef:        d.GitRef,
		Type:          d.Type,
		Status:        d.Status,
		ImageRef:      img,
		ContainerName: cn,
		ServicePort:   d.ServicePort,
		PreviewURL:    pu,
		CreatedAt:     d.CreatedAt,
		UpdatedAt:     d.UpdatedAt,
		PromotedAt:    pr,
	}
}

type logChunkResp struct {
	ID     int64     `json:"id"`
	TS     time.Time `json:"ts"`
	Stream string    `json:"stream"`
	Chunk  string    `json:"chunk"`
}

func toLogChunkResp(c db.DeploymentLogChunk) logChunkResp {
	return logChunkResp{
		ID:     c.ID,
		TS:     c.TS,
		Stream: c.Stream,
		Chunk:  c.Chunk,
	}
}
