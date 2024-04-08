import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Web3 } from "web3";
import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import data from "../data/data.json";
import BigNumber from "bignumber.js";

export default function MyAccount() {
  const [connectedAccount, setConnectedAccount] = useState();
  const [balance, setBalance] = useState();
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState(null);
  const [errorMessage, setErrorMessage] = useState({ balance: "" });
  const [tokenList, setTokenList] = useState([]);
  const [selectedItem, setSelectedItem] = useState([]);
  const [selectedSecondItem, setSelectedSecondItem] = useState([]);
  const [isOpenFirst, setIsOpenFirst] = useState(false);
  const [isOpenSecond, setIsOpenSecond] = useState(false);
  const [tokenPrice, setTokenPrice] = useState([]);
  const [current, setCurrent] = useState({
    from: "",
    to: "",
    decimals: 18,
  });
  const [gasFee, setGasFee] = useState([]);
  const [tokenPriceUSDT, setTokenPriceUSDT] = useState("");
  const [estimatedPriceImpact, setEstimatedPriceImpact] = useState("");
  const [calcPriceImpact, setCalcPriceImpact] = useState("");

  // chargement optimisé de la récupération de ma balance du wallet
  useEffect(() => {
    if (connectedAccount) {
      setLoading(true);
      getBalance(connectedAccount)
        .then((balance) => {
          setBalance(balance);
          setLoading(false);
        })
        .catch((error) => {
          setError(error.message);
          setLoading(false);
        });
    }
  }, [connectedAccount]);

  // connection au wallet metamask
  const connectMetamask = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setConnectedAccount(accounts[0]);
        getBalance(accounts[0]);
      }
    } catch (error) {
      setError(error.message);
    }
  };

  // Récupération du solde du portefeuille MetaMask de l'utilisateur et affichage converti en ETH.
  // Nous obtenons la liste des tokens affichés dans les boutons.
  // Ensuite, nous créons une nouvelle instance de contrat avec l'ABI et chaque adresse de token de la liste.
  // Nous utilisons ensuite la méthode balanceOf avec l'adresse du compte pour récupérer le solde du portefeuille selon les tokens sur lesquels nous itérons.
  // Nous utilisons Promise.all car nous faisons un map sur chaque token avec un await, donc nous attendons une réponse pour chaque token.
  const getBalance = async (connectedAccount) => {
    const provider = window.ethereum;
    const web3 = new Web3(provider);
    const balancePromises = tokenList.map(async (token) => {
      const tokenContract = new web3.eth.Contract(data, token.address);
      try {
        const balance = await tokenContract.methods
          .balanceOf(connectedAccount)
          .call();
        const divisor = new BigNumber(10).pow(new BigNumber(token.decimals));
        const balanceInToken = new BigNumber(balance).div(divisor);
        return { symbol: token.symbol, balance: balanceInToken.toFixed() };
      } catch (error) {
        console.log(error.message);
        return setErrorMessage({
          ...errorMessage,
          balance: (
            <span>
              Veuillez connecter votre portefeuille au réseau Ethereum
            </span>
          ),
        });
      }
    });
    const balances = await Promise.all(balancePromises);
    return balances;
  };

  // récuperation des tokens ERC20
  const fetchTokenList = async () => {
    try {
      const response = await fetch(
        "https://gateway.ipfs.io/ipns/tokens.uniswap.org"
      );
      const tokenListData = await response.json();
      const filteredToken = tokenListData.tokens.filter(
        (entry) => entry.chainId === 1
      );
      setTokenList(filteredToken);
      setLoadingList(false);
    } catch (error) {
      console.log(error.message);
      setLoadingList(true);
    }
  };

  useEffect(() => {
    fetchTokenList();
  }, []);

  // Récupération des prix via l'adresse des tokens
  // On récupère le nombre de décimales selon les tokens sélectionnés.
  const getPrice = async () => {
    if (!selectedItem || !selectedSecondItem) return;
    const amount = Number(current.from) * Math.pow(10, selectedItem[3]);
    const params = new URLSearchParams({
      sellToken: selectedItem[2],
      buyToken: selectedSecondItem[2],
      sellAmount: amount,
      priceImpactProtectionPercentage: 0.9,
    });
    const paramsPriceAgainstUSDT = new URLSearchParams({
      sellToken: selectedItem[2],
      buyToken: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      sellAmount: amount,
    });
    const headers = { "0x-api-key": "f3226fc9-8580-402d-851d-808413124d2b" };
    try {
      const response = await fetch(
        `https://api.0x.org/swap/v1/price?${params}`,
        { headers }
      );
      const responseUSDT = await fetch(
        `https://api.0x.org/swap/v1/price?${paramsPriceAgainstUSDT}`,
        { headers }
      );
      const tokenPriceResponse = await response.json();
      const tokenPriceUSDTResponse = await responseUSDT.json();
      const convertedPrice =
        tokenPriceResponse.buyAmount / Math.pow(10, selectedSecondItem[3]);
      const convertedPriceUSDT =
        tokenPriceUSDTResponse.buyAmount / Math.pow(10, 6);
      const valueUSDT = convertedPriceUSDT.toFixed(2);
      const value = convertedPrice.toFixed(2);
      const priceImpact =
        valueUSDT * (1 - parseFloat(tokenPriceResponse.estimatedPriceImpact));
      console.log(priceImpact);
      setTokenPriceUSDT(valueUSDT);
      setTokenPrice(value);
      setGasFee(tokenPriceResponse.estimatedGas);
      setEstimatedPriceImpact(tokenPriceResponse.estimatedPriceImpact);
      setCalcPriceImpact(priceImpact);
    } catch (error) {
      console.log(error.message);
    }
  };

  useEffect(() => {
    getPrice();
  }, [current, selectedItem, selectedSecondItem]);

  // Fonction pour effectuer un devis via 0x et effectuer une transaction par la suite
  const getQuote = async () => {
    if (!selectedItem || !selectedSecondItem) return;
    const amount = Number(current.from) * Math.pow(10, selectedItem[3]);
    const params = new URLSearchParams({
      sellToken: selectedItem[2],
      buyToken: selectedSecondItem[2],
      sellAmount: amount.toString(),
      takerAdress: connectedAccount,
    });
    const headers = { "0x-api-key": "f3226fc9-8580-402d-851d-808413124d2b" };
    try {
      const response = await fetch(
        `https://api.0x.org/swap/v1/quote?${params}`,
        { headers }
      );
      const swapQuote = await response.json();
      return swapQuote;
    } catch (error) {
      console.log(error.message);
    }
  };

  //Fonction pour effectuer un swap de tokens en créant un contrat
  const trySwap = async () => {
    const provider = window.ethereum;
    const web3 = new Web3(provider);
    if (!provider) {
      return;
    } else {
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      let takerAdress = accounts[0];
      const fromTokenAddress = selectedItem[2];

      const swapQuote = await getQuote();

      const ERC20TokenContract = new web3.eth.Contract(data, fromTokenAddress);

      //convertion du montant de l'input from, en wei, suivant le token séléctionné et son nombre de décimals
      //faire en sorte que le montant maximum ne dépasse pas la valeur de l'utilisateur
      const amountInWei = new BigNumber(current.from).multipliedBy(
        new BigNumber(10).pow(selectedItem[3])
      );

      //approbation du contrat, l'adresse target et le montant maximum
      //sendtransaction avec les informations nécéssaires
      await ERC20TokenContract.methods
        .approve(swapQuote.allowanceTarget, amountInWei.toString())
        .send({
          from: takerAdress,
          to: swapQuote.to,
          data: swapQuote.data,
          value: swapQuote.value,
          gasPrice: swapQuote.gasPrice,
          gas: swapQuote.gas,
        });
    }
  };

  const handleSelectItem = (symbol, logo, address, decimals) => {
    setSelectedItem(symbol, logo, address, decimals);
    setIsOpenFirst(false);
  };

  const handleSecondSelectItem = (symbol, logo, address, decimals) => {
    setSelectedSecondItem(symbol, logo, address, decimals);
    setIsOpenSecond(false);
  };

  const handleInputChange = (event) => {
    setCurrent({
      ...current,
      [event.target.name]: event.target.value,
    });
  };

  return (
    <>
      <div className="container py-16">
        <div className="flex justify-between text-center">
          <Card className="bg-[#eeeeee] shadow-xl w-1/3">
            <CardHeader className="pb-3">
              <CardDescription className="text-xl t text-[#777]">
                Balance Available
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center flex-col gap-3">
                <span className="text-black font-bold text-3xl">
                  {loading ? (
                    <p>Chargement...</p>
                  ) : errorMessage.balance ? (
                    <p>Erreur: {errorMessage.balance}</p>
                  ) : balance ? (
                    balance.map((token, index) =>
                      token.balance != 0 ? (
                        <p key={index}>
                          {token.balance}
                          {token.symbol}
                        </p>
                      ) : null
                    )
                  ) : null}
                </span>
                <div className="flex gap-3">
                  <Button className="bg-white text-black font-bold shadow-xl px-6">
                    Buy
                  </Button>
                  <Button className="bg-white text-black font-bold shadow-xl px-6">
                    Receive
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="bg-black rounded-2xl flex-col justify-center max-h-1/3 max-w-[480px] mt-16 flex p-2 gap-3">
          <div className="flex bg-[#1B1B1B] rounded-lg p-3 focus-within:border-white border border-transparent min-h-[120px]">
            <div className="flex flex-col">
              <p className="text-white">FROM</p>
              <input
                type="number"
                value={current.from}
                name="from"
                onChange={handleInputChange}
                placeholder="0"
                className="rounded-xl w-full mr-3 max-h-[44px] text-3xl focus:outline-none text-white font-semibold bg-[#1B1B1B] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {tokenPriceUSDT > 0 ? (
                <p className="text-white mt-3">{tokenPriceUSDT} $</p>
              ) : (
                ""
              )}
            </div>

            <Dialog open={isOpenFirst} onOpenChange={setIsOpenFirst}>
              <div
                className={`flex flex-col ${
                  selectedItem[0] == undefined
                    ? "justify-center"
                    : "justify-end"
                } `}
              >
                <Button
                  className="rounded-full h-min bg-[#2D2F36] hover:bg-[#41444F] text-xl font-medium p-2 mt-[-0.2rem]"
                  onClick={() => setIsOpenFirst(!isOpenFirst)}
                >
                  {selectedItem.length > 0 ? (
                    <>
                      <img
                        className="mr-2 object-cover rounded-full"
                        src={selectedItem[1]}
                        alt={selectedItem[0]}
                        width={30}
                        height={30}
                        loading="lazy"
                      />
                      <span>{selectedItem[0]}</span>
                      <ChevronDown className="ml-2" width={50} />
                    </>
                  ) : (
                    <ChevronDown className="ml-3" />
                  )}
                </Button>
                {selectedItem[0] ? (
                  <div className="flex justify-end mr-2">
                    {loading ? (
                      <p className="text-white">Chargement...</p>
                    ) : errorMessage.balance ? (
                      <p className="text-white">
                        Erreur: {errorMessage.balance}
                      </p>
                    ) : balance ? (
                      balance.map((token, index) =>
                        token.symbol == selectedItem[0] ? (
                          <p key={index} className="text-muted text-sm mt-3">
                            Solde : {token.balance}
                          </p>
                        ) : null
                      )
                    ) : null}
                  </div>
                ) : (
                  ""
                )}
              </div>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Coins</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-auto h-full">
                  <ul>
                    {loadingList ? (
                      <p>Loading...</p>
                    ) : (
                      tokenList.map((token, index) => {
                        return (
                          <li key={index}>
                            <div
                              className="flex cursor-pointer hover:bg-slate-300 py-3"
                              onClick={() => {
                                handleSelectItem([
                                  token.symbol,
                                  token.logoURI,
                                  token.address,
                                  token.decimals,
                                ]);
                              }}
                            >
                              <img
                                src={token.logoURI}
                                alt={token.symbol}
                                className="mr-3 rounded-full object-cover"
                                loading="lazy"
                                width={30}
                                height={30}
                              />
                              <span>{token.symbol}</span>
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex bg-[#1B1B1B] rounded-lg p-3 focus-within:border-white border border-transparent min-h-[120px]">
            <div className="flex flex-col">
              <p className="text-white">TO</p>
              <input
                type="number"
                value={current.to > 0 ? current.to : tokenPrice}
                name="to"
                onChange={handleInputChange}
                placeholder="0"
                className="rounded-xl w-full mr-3 max-h-[44px] text-3xl outline-none text-white font-semibold bg-[#1B1B1B] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {tokenPriceUSDT > 0 ? (
                calcPriceImpact < tokenPriceUSDT ? (
                  <p className="text-white mt-3">
                    {calcPriceImpact} $ (-{estimatedPriceImpact}%)
                  </p>
                ) : (
                  <p className="text-white mt-3">{tokenPriceUSDT} $</p>
                )
              ) : (
                ""
              )}
            </div>
            <Dialog open={isOpenSecond} onOpenChange={setIsOpenSecond}>
              <div className="flex flex-col justify-center">
                <Button
                  className={
                    selectedSecondItem.length > 0
                      ? "rounded-full h-min bg-[#2D2F36] hover:bg-[#41444F] text-xl font-medium p-2 mt-[-0.2rem]"
                      : "rounded-full font-bold bg-[#FC72FF] hover:bg-[#fd72ffdb] text-lg pr-0 mt-[-0.2rem]"
                  }
                  onClick={() => setIsOpenSecond(!isOpenSecond)}
                >
                  {selectedSecondItem.length > 0 ? (
                    <>
                      <img
                        className="mr-2 object-cover rounded-full"
                        src={selectedSecondItem[1]}
                        alt={selectedSecondItem[0]}
                        width={30}
                        height={30}
                        loading="lazy"
                      />
                      <span>{selectedSecondItem[0]}</span>
                      <ChevronDown className="ml-2" width={50} />
                    </>
                  ) : (
                    <>
                      <span>Sélectionnez le jeton</span>
                      <ChevronDown width={50} />
                    </>
                  )}
                </Button>
                {selectedSecondItem[0] ? (
                  <div className="flex justify-end mr-2">
                    {loading ? (
                      <p>Chargement...</p>
                    ) : errorMessage.balance ? (
                      <p>Erreur: {errorMessage.balance}</p>
                    ) : balance ? (
                      balance.map((token, index) =>
                        token.symbol == selectedSecondItem[0] ? (
                          <p key={index} className="text-muted text-sm mt-3">
                            Solde : {token.balance}
                          </p>
                        ) : null
                      )
                    ) : null}
                  </div>
                ) : (
                  ""
                )}
              </div>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Coins</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-auto h-full">
                  <ul>
                    {loadingList ? (
                      <p>Loading...</p>
                    ) : (
                      tokenList.map((token, index) => {
                        return (
                          <li key={index}>
                            <div
                              className="flex cursor-pointer hover:bg-slate-300 py-3"
                              onClick={() => {
                                handleSecondSelectItem([
                                  token.symbol,
                                  token.logoURI,
                                  token.address,
                                  token.decimals,
                                ]);
                              }}
                            >
                              <img
                                src={token.logoURI}
                                alt={token.symbol}
                                className="mr-3 rounded-full object-cover"
                                loading="lazy"
                                width={30}
                                height={30}
                              />
                              <span>{token.symbol}</span>
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-white px-3">Estimated Gas: {gasFee}</p>
          {connectedAccount && loadingList === false ? (
            <Button
              className="w-full py-8 font-bold text-lg bg-[#311C31] hover:bg-[#432643] text-[#FC72FF]"
              onClick={() => trySwap()}
            >
              Swap
            </Button>
          ) : (
            <Button
              onClick={connectMetamask}
              className="w-full py-8 font-bold text-lg bg-[#311C31] hover:bg-[#432643] text-[#FC72FF]"
            >
              Connecter MetaMask
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
