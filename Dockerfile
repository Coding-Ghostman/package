FROM node:alpine
WORKDIR /usr/src/app
COPY . .
RUN npm install
# Copy the oci folder to the root directory
CMD [ "npm" , "start" ]
