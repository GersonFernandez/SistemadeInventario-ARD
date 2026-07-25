if (!(Test-Path .env.prod)) {
	Copy-Item .env.prod.example .env.prod
	Write-Host "Se creo .env.prod desde .env.prod.example."
	Write-Host "Edita .env.prod (SECRET_KEY, passwords, hosts) y vuelve a ejecutar este script."
	exit 1
}

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build --pull always --wait
