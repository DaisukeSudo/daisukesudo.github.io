docker run \
  --rm -it \
  -p 80:80 \
  -v $PWD:/usr/share/nginx/html:ro \
  nginx:mainline-alpine
