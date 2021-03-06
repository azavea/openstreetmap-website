# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  # use official ubuntu image for virtualbox
  config.vm.provider "virtualbox" do |vb, override|
    override.vm.box = "bento/ubuntu-19.10"
    override.vm.synced_folder ".", "/srv/openstreetmap-website"
    vb.customize ["modifyvm", :id, "--memory", "4096"]
    vb.customize ["modifyvm", :id, "--cpus", "2"]
    vb.customize ["modifyvm", :id, "--uartmode1", "disconnected"]
  end

  # Use sshfs sharing if available, otherwise NFS sharing
  sharing_type = Vagrant.has_plugin?("vagrant-sshfs") ? "sshfs" : "nfs"

  # use third party image and sshfs or NFS sharing for lxc
  config.vm.provider "lxc" do |_, override|
    override.vm.box = "bento/ubuntu-19.10"
    override.vm.synced_folder ".", "/srv/openstreetmap-website", :type => sharing_type
  end

  # use third party image and sshfs or NFS sharing for libvirt
  config.vm.provider "libvirt" do |_, override|
    override.vm.box = "bento/ubuntu-19.10"
    override.vm.synced_folder ".", "/srv/openstreetmap-website", :type => sharing_type
  end

  # configure shared package cache if possible
  if Vagrant.has_plugin?("vagrant-cachier")
    config.cache.enable :apt
    config.cache.scope = :box
  end

  # port forward for webrick on 3003
  config.vm.network :forwarded_port, :guest => 3000, :host => 3003

  # work around grub-pc prompt issue
  # https://github.com/chef/bento/issues/661#issuecomment-248136601
  # provision using a simple shell script
  config.vm.provision :shell, :inline => "DEBIAN_FRONTEND=noninteractive cd /srv/openstreetmap-website && ./script/setup/provision.sh"
end
