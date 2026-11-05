# Mojšová Lúčka - pingpong - 2026

Webová aplikácia na organizáciu pingpongového turnaja pre Node.js. Obsahuje správu skupín, hráčov a štartovného, losovanie, zápis skóre a vyhodnotenie. Verejný náhľad sa aktualizuje automaticky.

## Spustenie

Potrebujete Node.js 22 alebo novší s npm. Projekt nemá externé závislosti, takže npm install nie je potrebné.

V termináli v priečinku projektu spustite:

```sh
npm start
```

- Administrácia: http://localhost:3000/management
- Verejný náhľad: http://localhost:3000/preview
- Vypnutie: Ctrl + C v termináli so serverom.
- Testy: npm test

## Prístup z iných zariadení

V PowerShelli pred spustením nastavte:

```powershell
$env:ADMIN_TOKEN="vas-dlhy-nahodny-tajny-kluc"
$env:HOST="0.0.0.0"
$env:PORT="3000"
npm start
```

Na mobile otvorte http://IP-ADRESA-POCITACA:3000/preview. Zariadenia musia byť v rovnakej sieti a firewall musí povoliť port. Administrácia si vyžiada nastavený kľúč. Bez ADMIN_TOKEN používajte aplikáciu iba lokálne. Súbor .env sa automaticky nenačítava.

## Používanie

Nová skupina má predvolene 10 hráčov, set do 11 bodov a 2 sety medzi každou dvojicou. Hráčov pridáte pluskom v tabuľke. Losovanie je dostupné až po naplnení nastavenej kapacity a zaplatení štartovného všetkých hráčov.

Skóre zapisujte v Zápasoch naživo a potvrďte Uložiť. Edit umožní opravu. Po zapísaní všetkých zápasov možno skupinu vyhodnotiť; výsledky sa uzamknú. Poradie určuje počet výhier a potom získané body. Pri úplnej zhode je delené miesto.

Vymazanie výsledkov zruší vyhodnotenie a odomkne skóre. Vymazanie losovania odstráni zápasy aj skóre a odomkne skupinu; hráči a platby zostanú zachované. Vymazanie skupiny odstráni všetky jej údaje.

## Uložené údaje

Dáta sa automaticky ukladajú do data/tournament.json. Priečinok data zálohujte pri zastavenom serveri. Je ignorovaný Gitom, takže hráči, platby a výsledky sa nenahrávajú na GitHub. Po stiahnutí projektu vznikne prázdny turnaj.

Prevádzkujte iba jeden proces aplikácie nad jedným dátovým priečinkom. Premenná DATA_DIR umožňuje zvoliť iný priečinok.

Pre internetové nasadenie použite HTTPS, silný ADMIN_TOKEN a reverzný proxy s vypnutým bufferingom pre /events. GitHub Pages nestačí na prevádzku Node.js servera.

## Príprava na GitHub

Nahrajte zdrojové súbory, priečinky public a images, package.json, testy, README.md a .gitignore. Nenahrávajte data, node_modules ani súbory s heslami. Po stiahnutí projektu stačí v jeho priečinku spustiť npm start.
