ARG IMAGE=twilio/twilio-video-browsers:chrome-stable
FROM $IMAGE

RUN sudo apt-get update
RUN sudo apt-get install -y libasound2 libpango1.0-0 libxt6 wget bzip2 sudo libdbus-glib-1-2 libgtk-3-0 iptables net-tools
RUN sudo groupadd docker
RUN sudo usermod -aG docker user1
RUN sudo su user1

WORKDIR /app
COPY . /app

CMD ["bash"]
