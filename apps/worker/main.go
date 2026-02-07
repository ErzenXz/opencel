package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/hibiken/asynq"
	"github.com/opencel/opencel/internal/config"
	"github.com/opencel/opencel/internal/db"
	"github.com/opencel/opencel/internal/queue"
	"github.com/opencel/opencel/internal/worker"
)

func main() {
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	conn, err := db.Open(cfg.DSN)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer conn.Close()

	store := db.NewStore(conn)

	w, err := worker.New(cfg, store)
	if err != nil {
		log.Fatalf("worker init: %v", err)
	}

	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: cfg.RedisAddr},
		asynq.Config{
			Concurrency: 2,
		},
	)

	mux := asynq.NewServeMux()
	mux.HandleFunc(queue.TaskBuildDeploy, func(ctx context.Context, t *asynq.Task) error {
		var p queue.BuildDeployPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return err
		}
		return w.BuildAndDeploy(ctx, p.DeploymentID)
	})

	go func() {
		for {
			time.Sleep(30 * time.Second)
		}
	}()

	log.Printf("worker started")
	if err := srv.Run(mux); err != nil {
		log.Fatalf("asynq: %v", err)
	}
}
