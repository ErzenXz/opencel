package api

import (
	"context"
	"errors"
)

type httpErr struct {
	status int
	msg    string
}

func roleRank(role string) int {
	switch role {
	case "owner":
		return 3
	case "admin":
		return 2
	case "member":
		return 1
	default:
		return 0
	}
}

func (s *Server) requireOrgRole(ctx context.Context, userID, orgID, minRole string) *httpErr {
	role, err := s.Store.GetOrgRole(ctx, userID, orgID)
	if err != nil {
		return &httpErr{status: 500, msg: err.Error()}
	}
	if role == "" {
		return &httpErr{status: 403, msg: "forbidden"}
	}
	if roleRank(role) < roleRank(minRole) {
		return &httpErr{status: 403, msg: "forbidden"}
	}
	return nil
}

func (s *Server) requireProjectMember(ctx context.Context, userID, projectID string) (*string, error) {
	p, err := s.Store.GetProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, errors.New("not found")
	}
	ok, err := s.Store.IsUserOrgMember(ctx, userID, p.OrgID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("forbidden")
	}
	return &p.OrgID, nil
}
