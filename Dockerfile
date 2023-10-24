FROM python:3.10.11-alpine3.18 as python-builder

WORKDIR /app

RUN apk add git

ADD requirements.txt .

RUN python -m venv venv
RUN venv/bin/pip install -r requirements.txt

FROM python:3.10.11-alpine3.18

WORKDIR /app

COPY --from=python-builder /app .

EXPOSE 8000
VOLUME ["/data"]

ADD main.py /app/main.py
ADD assets /app/assets

ENTRYPOINT /app/venv/bin/python \
	/app/main.py \
	--config /data \
	--host '0.0.0.0' \
	--port 8000
