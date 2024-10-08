# Use an official Node.js runtime as the base image
FROM node:14 as build-stage

# Set the working directory in the container
WORKDIR /function

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the application dependencies
RUN npm install

# Copy the rest of the application code to the working directory
ADD . /function/

RUN mkdir -p /home/fn/.oci

COPY config /home/fn/.oci

COPY private_key.pem /home/fn/.oci

RUN chmod -R o+r /function
# Expose the port that the app runs on
EXPOSE 3000

ENTRYPOINT ["node", "func.js"]
# Define the command to run the application
CMD ["npm", "start"]
