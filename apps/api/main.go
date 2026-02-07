package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/opencel/opencel/internal/api"
	"github.com/opencel/opencel/internal/config"
	"github.com/opencel/opencel/internal/db"
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
	if err := db.Ping(context.Background(), conn); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	store := db.NewStore(conn)
	if err := api.RunMigrations(cfg.DSN); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	if err := api.BootstrapAdmin(context.Background(), store, cfg.BootstrapEmail, cfg.BootstrapPassword); err != nil {
		log.Fatalf("bootstrap: %v", err)
	}

	srv, err := api.NewServer(cfg, store)
	if err != nil {
		log.Fatalf("server: %v", err)
	}

	httpSrv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           srv.Router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("api listening on %s", cfg.HTTPAddr)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	ch := make(chan os.Signal, 2)
	signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
	<-ch

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(ctx)
}
