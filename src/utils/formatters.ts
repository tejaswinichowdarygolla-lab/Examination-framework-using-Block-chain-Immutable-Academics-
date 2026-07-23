export const truncateAddress = (addr: string, start = 6, end = 4) => {
  if (!addr) return '';
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
};

export const formatBlockTime = (timestamp: string | number) => {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString();
};

export const formatETH = (wei: string | number) => {
  if (!wei) return '0.0000 ETH';
  const eth = Number(wei) / 10**18;
  return `${eth.toFixed(4)} ETH`;
};

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
