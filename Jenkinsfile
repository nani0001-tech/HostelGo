pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
    }

    environment {
        COMPOSE_FILE = 'docker-compose.yml'
        DOCKER_ENV_FILE = '.env.docker'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out the main branch of HostelGo.'
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[url: 'https://github.com/nani0001-tech/HostelGo.git']]
                ])
            }
        }

        stage('Backend validation/test') {
            steps {
                echo 'Installing backend dependencies and running its offer negotiation smoke test.'
                dir('backend') {
                    powershell 'npm ci'
                    powershell 'npm run test:offers'
                }
            }
        }

        stage('Frontend build/test') {
            steps {
                echo 'Installing frontend dependencies and building the production bundle.'
                dir('frontend') {
                    powershell 'npm ci'
                    powershell 'npm run build'
                }
            }
        }

        stage('Docker image build') {
            steps {
                echo 'Building the existing Compose backend and frontend images.'
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    if (-not (Test-Path -LiteralPath $env:DOCKER_ENV_FILE -PathType Leaf)) {
                        throw 'Required .env.docker file is missing from the Jenkins workspace.'
                    }
                    docker compose --env-file $env:DOCKER_ENV_FILE -f $env:COMPOSE_FILE build backend frontend
                    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose image build failed.' }
                '''
            }
        }

        stage('Docker deployment') {
            steps {
                echo 'Deploying the existing Compose frontend and backend services.'
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    if (-not (Test-Path -LiteralPath $env:DOCKER_ENV_FILE -PathType Leaf)) {
                        throw 'Required .env.docker file is missing from the Jenkins workspace.'
                    }
                    docker compose --env-file $env:DOCKER_ENV_FILE -f $env:COMPOSE_FILE up -d --remove-orphans backend frontend
                    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose deployment failed.' }
                '''
            }
        }

        stage('Deployment health verification') {
            steps {
                echo 'Waiting for the deployed backend and frontend HTTP health checks.'
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    $checks = @(
                        @{ Name = 'Backend'; Url = 'http://localhost:5000/api/health' },
                        @{ Name = 'Frontend'; Url = 'http://localhost:8080/' }
                    )
                    foreach ($check in $checks) {
                        $healthy = $false
                        for ($attempt = 1; $attempt -le 18; $attempt++) {
                            try {
                                $response = Invoke-WebRequest -Uri $check.Url -Method Get -TimeoutSec 5 -UseBasicParsing
                                if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                                    Write-Host "$($check.Name) is responding successfully."
                                    $healthy = $true
                                    break
                                }
                            } catch {
                                Start-Sleep -Seconds 5
                            }
                        }
                        if (-not $healthy) {
                            throw "$($check.Name) health check failed at $($check.Url)."
                        }
                    }
                '''
            }
        }
    }
}
