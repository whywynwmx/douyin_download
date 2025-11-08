{ pkgs }: {
  deps = [
    pkgs.go
    pkgs.git
    pkgs.cacert
  ];

  env = {
    PORT = "8080";
    GIN_MODE = "release";
  };

  # 工作目录设置为go子目录
  workdir = "go";
}