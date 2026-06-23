# Local dev server supervised by Nomad — auto-restarts on crash.
# Run: npm run dev:nomad

variable "project_root" {
  type        = string
  description = "Absolute path to the repo root"
}

variable "node_bin" {
  type        = string
  description = "Absolute path to the node executable"
}

job "badazz-tasks-dev" {
  datacenters = ["dc1"]
  type        = "service"

  group "dev" {
    count = 1

    # Restart the Next.js process when it exits unexpectedly.
    restart {
      attempts = 0
      interval = "24h"
      delay    = "5s"
      mode     = "fail"
    }

    # Re-place the allocation if the local Nomad node blips.
    reschedule {
      delay          = "5s"
      delay_function = "constant"
      unlimited      = true
    }

    network {
      mode = "host"

      port "http" {
        static = 3000
      }
    }

    task "next-dev" {
      driver = "raw_exec"

      config {
        command = var.node_bin
        args = [
          "${var.project_root}/scripts/dev-start.mjs",
        ]
      }

      env {
        PORT               = "3000"
        BADAZZ_DEV_BUNDLER = "turbopack"
        NODE_OPTIONS       = "--max-old-space-size=4096"
        NOMAD_DEV          = "1"
      }

      resources {
        cpu    = 2000
        memory = 4096
      }

      kill_timeout = "30s"
    }
  }
}
