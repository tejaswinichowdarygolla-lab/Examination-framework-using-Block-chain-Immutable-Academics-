module.exports = {
  contracts_directory: "./backend/contracts",
  contracts_build_directory: "./src/contracts/abis",
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "5777", // Ganache GUI default
    }
  },
  compilers: {
    solc: {
      version: "0.8.20",
      settings: {
        evmVersion: "paris"
      }
    }
  }
};
