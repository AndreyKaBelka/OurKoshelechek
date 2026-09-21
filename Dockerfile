FROM golang:1.26-alpine AS builder

WORKDIR /src

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /out/ourkoshelechek ./cmd/app

FROM alpine:3.20

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=builder /out/ourkoshelechek .

EXPOSE 8080

ENTRYPOINT ["./ourkoshelechek"]
