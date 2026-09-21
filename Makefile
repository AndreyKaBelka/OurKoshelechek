.PHONY: build run run-testserver generate tidy fmt vet lint test clean \
	migrate-up migrate-up-by-one migrate-up-to migrate-down migrate-down-to \
	migrate-redo migrate-reset migrate-status migrate-version migrate-create migrate-fix

BINARY := ourkoshelechek
TESTSERVER_BINARY := testserver
BIN_DIR := bin

GOOSE := go run github.com/pressly/goose/v3/cmd/goose
MIGRATIONS_DIR := db/migrations
DB_DSN ?= postgres://postgres:postgres@localhost:5432/ourkoshelechek?sslmode=disable

build:
	go build -o $(BIN_DIR)/$(BINARY) ./cmd/app

run:
	go run ./cmd/app

run-testserver:
	go run ./cmd/testserver

generate:
	go run github.com/99designs/gqlgen generate

tidy:
	go mod tidy

fmt:
	gofmt -l -w .

vet:
	go vet ./...

lint:
	golangci-lint run ./...

test:
	go test ./...

clean:
	rm -rf $(BIN_DIR)

# Database migrations (goose).
# Override the DSN with: make migrate-up DB_DSN=postgres://...

migrate-up:
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" up

migrate-up-by-one:
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" up-by-one

migrate-up-to:
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" up-to $(version)

migrate-down:
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" down

migrate-down-to:
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" down-to $(version)

migrate-redo:
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" redo

migrate-reset:
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" reset

migrate-status:
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" status

migrate-version:
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" version

migrate-fix:
	$(GOOSE) -dir $(MIGRATIONS_DIR) fix

migrate-create:
	@if [ -z "$(name)" ]; then echo "usage: make migrate-create name=<migration_name>"; exit 1; fi
	$(GOOSE) -dir $(MIGRATIONS_DIR) create $(name) sql
