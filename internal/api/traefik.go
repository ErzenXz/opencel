package api

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

type traefikDynamic struct {
	// Traefik v3.6+ file provider can load HTTP config directly from a file when using providers.file.filename.
	// In that mode, the file should contain `routers:` and `services:` at the root (no `http:` wrapper).
	// This struct matches dynamic.HTTPConfiguration.
	Routers  map[string]traefikRouter  `yaml:"routers"`
	Services map[string]traefikService `yaml:"services"`
}

type traefikRouter struct {
	Rule        string   `yaml:"rule"`
	EntryPoints []string `yaml:"entryPoints"`
	TLS         any      `yaml:"tls"`
	Service     string   `yaml:"service"`
}

type traefikService struct {
	LoadBalancer traefikLB `yaml:"loadBalancer"`
}

type traefikLB struct {
	Servers []traefikServer `yaml:"servers"`
}

type traefikServer struct {
	URL string `yaml:"url"`
}

func (s *Server) writeTraefikProdRoute(ctx context.Context, _ string) error {
	projects, err := s.Store.ListProjects(ctx)
	if err != nil {
		return err
	}

	dyn := traefikDynamic{
		Routers:  map[string]traefikRouter{},
		Services: map[string]traefikService{},
	}

	for _, p := range projects {
		if !p.ProductionDeploymentID.Valid || p.ProductionDeploymentID.String == "" {
			continue
		}
		d, err := s.Store.GetDeployment(ctx, p.ProductionDeploymentID.String)
		if err != nil || d == nil {
			continue
		}
		if !d.ContainerName.Valid || d.ContainerName.String == "" {
			continue
		}

		routerName := "prod-" + p.Slug
		serviceName := "prod-" + p.Slug
		host := fmt.Sprintf("%s.prod.%s", p.Slug, s.Cfg.BaseDomain)

		rt := traefikRouter{
			Rule:        fmt.Sprintf("Host(\"%s\")", host),
			EntryPoints: []string{s.Cfg.TraefikEntrypoint},
			Service:     serviceName,
		}
		if s.Cfg.TraefikTLS {
			rt.TLS = map[string]any{}
		}
		dyn.Routers[routerName] = rt
		dyn.Services[serviceName] = traefikService{
			LoadBalancer: traefikLB{
				Servers: []traefikServer{
					{URL: fmt.Sprintf("http://%s:%d", d.ContainerName.String, d.ServicePort)},
				},
			},
		}
	}

	b, err := yaml.Marshal(dyn)
	if err != nil {
		return err
	}

	// Atomic write
	path := s.Cfg.TraefikDynamicPath
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp := fmt.Sprintf("%s.tmp.%d", path, time.Now().UnixNano())
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
