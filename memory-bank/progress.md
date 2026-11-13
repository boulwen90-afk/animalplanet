# AnimalPlanet – framsteg

Uppdateras efter varje avslutad fas. Senaste fasen överst.

## Nuläge

- **Aktuell fas:** Fas 8 – klar i kod, pull request öppen mot `main`
- **Nästa steg:** användaren har gett klartecken (2026-11-13) att köra fas 9
  och sedan fas 10 utan nytt godkännande, så länge allt fungerar. Varje fas
  mergas när CI är grön
- **Publicering:** https://boulwen90-afk.github.io/animalplanet/ uppdateras
  vid varje merge till `main`. Att sidan visar spelet är inte kontrollerat
  från Claudes session, som inte når github.io

## Fasstatus

| Fas | Innehåll | Status | PR |
|---|---|---|---|
| 0 | Planeringsdokument | Godkänd 2026-11-12 | – |
| 1 | Projektuppsättning, deploy, scrollbar karta | Mergad och publicerad | [#1](https://github.com/boulwen90-afk/animalplanet/pull/1) |
| 2 | Simuleringskärna och terräng | Mergad | [#2](https://github.com/boulwen90-afk/animalplanet/pull/2) |
| 3 | Enheter, markering, förflyttning | Mergad | [#3](https://github.com/boulwen90-afk/animalplanet/pull/3) |
| 4 | Resurser och insamling | Mergad | [#4](https://github.com/boulwen90-afk/animalplanet/pull/4) |
| 5 | Träna arbetare | Mergad | [#5](https://github.com/boulwen90-afk/animalplanet/pull/5) |
| 6 | Bygga Visthus och Krigshall | Mergad | [#6](https://github.com/boulwen90-afk/animalplanet/pull/6) |
| 7 | Soldater, strid, kapitulation, vinst och förlust | Mergad | [#7](https://github.com/boulwen90-afk/animalplanet/pull/7) |
| 8 | Krigsdimma | Klar, väntar på merge | Se fasloggen |
| 9 | AI-motståndare | Ej påbörjad | – |
| 10 | Pekstyrning, balans, MVP-avstämning | Ej påbörjad | – |

## Fasloggar

<!--
Mall – kopiera för varje avslutad fas:

### Fas N – namn (ÅÅÅÅ-MM-DD)
**PR:** länk
**Skärmdump:** docs/screenshots/fas-N.png

**Avstämning mot planen**
| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. … | Klar / Avviker / Saknas | |

**Saknas eller avviker**
- …

**Testresultat**
- Vitest: X av X
- Playwright: X av X
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- …
-->

### Fas 8 – Krigsdimma (2026-11-13)

**Skärmdumpar:** `docs/screenshots/fas-8-tre-lagen.png` (alla tre lägen:
full sikt vid basen och spejaren, nedtonad mark där spejaren har gått, svart
där ingen har varit), `docs/screenshots/fas-8-start.png` (vid start)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Synlighetsrutnät per spelare: outforskad, utforskad, synlig | Klar | |
| 2. Uppdatering från alla egna enheters och byggnaders synfält | Klar | Varje steg. Byggen under uppförande ser 2 rutor |
| 3. Rendering: svart, nedtonad terräng respektive full sikt; fiendens enheter och byggnader döljs utanför synliga rutor | Klar | |
| 4. Byggplacering kräver utforskade rutor; order mot ett mål som försvinner ur sikte avbryts | Klar | Kravet som saknades i fas 6 är nu uppfyllt |
| 5. `?fog=0` i testläge stänger av dimman | Klar | Utan `?test=1` har parametern ingen verkan |

| Test i planen | Resultat |
|---|---|
| Vitest: en enhet med synfält 6 gör rätt rutor synliga | Godkänt (alla 900 rutor på testkartan kontrolleras) |
| Vitest: när den går vidare blir rutorna utforskade, inte outforskade | Godkänt |
| Vitest: en fiende utanför synfältet finns inte i spelarens synliga entiteter | Godkänt |
| Vitest: byggplacering på outforskad ruta nekas | Godkänt, även delvis outforskad plats |
| Playwright: vid start är fiendens bas inte synlig enligt `getState()` | Godkänt |
| Playwright: efter att en enhet gått dit är den det | Godkänt |
| Skärmdump som visar alla tre dimlägen | Klar |

Utöver planen testas även: byggnaders synfält, att terräng inte skymmer, att
sidorna inte delar sikt, att kapitulerade enheter inte ser, att en anfallare
ger upp när målet försvinner i dimman, att en dold fiende inte går att
markera och att en markerad fiende avmarkeras när den försvinner, samt att
`?fog=0` saknar verkan utanför testläge (genom att jämföra bilder).

**Saknas eller avviker**
- **Utforskad mark visar kartan som den är nu**, inte som den såg ut när
  spelaren var där. Ett träd som fienden har huggit ned försvinner alltså
  från spelarens bild även om ingen ser det.
- **Enheter hittar vägen genom outforskad mark.** Vägsökningen känner hela
  kartan, så en enhet som skickas in i det svarta går runt hinder spelaren
  aldrig har sett.
- **Träd i dimmans kant ritas delvis nedtonade.** Dimman ligger per ruta,
  och ett träd är högre än sin ruta.
- **Utforskad mark har ett mörkare rutnät.** Dimrutorna överlappar en
  pixel för att täta skarvarna, och där två halvgenomskinliga rutor möts
  blir det mörkare.
- **Fiendens byggnader glöms så fort de är ur sikte.** Det följer GDD:t.
- **Byggen under uppförande ser 2 rutor.** GDD:t anger bara synfält för
  färdiga byggnader.
- **Inga äldre tester behövde `?fog=0`.** Planen räknade med det; de gick
  igenom med dimman på.
- **AI:n ska enligt GDD:t inte påverkas av dimman.** Det hanteras i fas 9;
  i nuläget gäller dimman lika för båda sidor.

**Testresultat**
- Vitest: 352 av 352
- Playwright: 71 av 71, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Första versionen lät rutnätet lysa svagt genom skarvarna i det svarta,
  vilket hade kunnat avslöja sjöar. Det syntes på skärmdumpen. Dimrutorna
  överlappar nu en pixel.
- Ett av de nya webbläsartesterna påstod sig kontrollera att `?fog=0` inte
  verkar utanför testläge, men kontrollerade ingenting. Det jämför nu
  andelen grön mark i bilden.
- En byggnad som rasar dold i dimman skakar inte längre skärmen.

### Fas 7 – Soldater, strid, kapitulation, vinst och förlust (2026-11-12)

**Skärmdumpar:** `docs/screenshots/fas-7-strid.png` (strid vid basen med
livstaplar, träffblink, vita flaggor, grottor och varningstext),
`docs/screenshots/fas-7-grotta.png` (efter striden: en egen soldat har gått
in i grottan, 1/12), `docs/screenshots/fas-7-nederlag.png` (slutskärmen)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Krigshallen tränar Ramkrigare | Klar | 60 mat och 25 trä, 18 s |
| 2. `attack`-kommando mot enheter och byggnader; förföljelse; skadeformel och anfallstakt | Klar | |
| 3. Automatiskt anfall för stillastående Ramkrigare (inom 6 rutor) | Klar | Bara mot enheter, se avvikelser |
| 4. Grottor: 2 per sida med 12 platser, speglade, nåbara; blockerar sin ruta, kan inte anfallas, inget byggs på eller intill | Klar | |
| 5. Kapitulation: kan inte anfallas eller ges order, räknas inte i befolkningen, går till närmaste egna grotta, platsen reserveras, försvinner om ingen grotta finns | Klar | |
| 6. Byggnader rasar när livet når 0 och frigör sina rutor | Klar | |
| 7. Fiendesidan är passiv tills AI:n kommer | Klar | Den har bara Samlare, som aldrig anfaller självmant |
| 8. Vinst/förlust när en Storide rasar; slutskärm med "Spela igen" | Klar | |
| 9. Livstaplar, träffblink, utfall, vit flagga, bortoning, skärmskakning och larmtext | Klar | |
| 10. Gränssnittet säger "Liv" i stället för "HP" | Klar | |

| Test i planen | Resultat |
|---|---|
| Vitest: skada = skada − rustning, minst 1 | Godkänt |
| Vitest: slag sker med rätt intervall | Godkänt (direkt, sedan var 24:e steg) |
| Vitest: en Ramkrigare får en Samlare att kapitulera på förväntat antal steg | Godkänt (exakt 73 steg) |
| Vitest: anfallare följer efter ett flyende mål | Godkänt |
| Vitest: Ramkrigare anfaller fiende inom 6 rutor men inte utanför | Godkänt |
| Vitest: en raserad byggnad frigör sina rutor | Godkänt |
| Vitest: en raserad Storide sätter rätt vinnare och stoppar simuleringen | Godkänt, för båda sidor |
| Vitest: en kapitulerad enhet tar ingen mer skada och väljs inte som mål | Godkänt |
| Vitest: den går till närmaste egna grotta, tas bort vid ankomsten, grottans antal ökar med 1 | Godkänt |
| Vitest: befolkningen minskar redan vid kapitulationen | Godkänt |
| Vitest: den trettonde enheten går till den andra grottan | Godkänt |
| Vitest: när alla 24 platser är tagna försvinner nästa enhet direkt | Godkänt |
| Vitest: en enhet går aldrig till motståndarens grotta | Godkänt |
| Vitest: varje sida har 2 grottor, de är speglade och nåbara från startplatsen | Godkänt för 40 frön |
| Vitest: byggplacering på eller intill en grotta nekas | Godkänt |
| Playwright: soldater anfaller fiendens Storide, "Seger" visas | Godkänt, med dragruta och högerklick |
| Playwright: motsvarande för "Nederlag" | Godkänt |
| Playwright: en besegrad enhet hamnar i sin sidas grotta | Godkänt |
| Skärmdump av strid, kapitulerad enhet på väg till grotta och slutskärm | Klar |

Utöver planen testas även: Samlare som slåss på order, anfallare som sprider
sig runt målet, ogiltiga mål, mål som inte går att nå, flyttorder som
avbryter anfall, last som tappas, kapitulerade enheter som inte lyder order
eller kan markeras i grupp, grottor som minns djurens typ, varningstexten,
skärmskakningen, att simuleringen står still efter avgörandet, och att
"Spela igen" ger ett nytt spel.

**Saknas eller avviker**
- **Soldater anfaller självmant bara enheter, inte byggnader.** GDD:t säger
  "fiender". Byggnader anfalls på order, annars skulle sysslolösa soldater
  vandra iväg mot närmaste fiendebyggnad.
- **Arbetare som blir anfallna gör ingenting åt det.** De fortsätter med
  sitt tills de kapitulerar. GDD:t säger bara att Samlare anfaller på order.
- **Grottorna ligger på den egna halvan av kartan**, så en enhet som
  besegras vid fiendens bas går över hela kartan med vit flagga. Det tar
  runt en halv minut.
- **Antalet djur i fiendens grottor syns för spelaren.** Det döljs först
  när krigsdimman finns (fas 8).
- **Grottor går inte att markera.** Antalet står ovanför grottan.
- **Varningen "Din bas anfalls!" kommer bara när en byggnad träffas**,
  inte när enheter anfalls.
- **Byggen under uppförande har ingen livstapel**; deras liv växer av sig
  självt och visas i markeringspanelen.
- **"Spela igen" laddar om sidan** och ger samma karta, eftersom fröet står
  kvar i adressen.
- **En enhet stannar där den står när målet kommer inom räckhåll**, vilket
  kan vara mellan två rutors mittpunkter.
- **Flera anfallare kan dela ruta** när alla rutor runt målet är upptagna.
- **Skärmskakningen går på Phasers egen klocka** och kan vara längre än
  150 ms vid låg bildfrekvens.
- **Testgränssnittet har fått `spawnUnit`**, som skapar enheter ur intet.
  Det finns bara i testläge.
- **Pekskärm:** anfallsorder kräver högerklick. Det hör till fas 10.

**Testresultat**
- Vitest: 329 av 329
- Playwright: 64 av 64, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Simuleringen rapporterar nu händelser per steg, så att renderingen kan
  visa blink, utfall, skakning och varning.
- Tre webbläsartester fallerade först för att nyskapade soldater genast
  anföll fiendens arbetare på eget initiativ och hade flyttat sig när testet
  drog sin ruta. Spelet gjorde rätt. Testerna ställer nu soldaterna utom
  synhåll.
- Första versionen kunde lägga en grotta på kartans yttersta ruta, så att
  halva grottan hängde utanför. Det syntes på skärmdumpen. Grottor håller nu
  2 rutor från kanten.

### Fas 6 – Bygga Visthus och Krigshall (2026-11-12)

**Skärmdumpar:** `docs/screenshots/fas-6-spokbild.png` (byggmeny och grön
kontur på giltig plats), `docs/screenshots/fas-6-ogiltig-plats.png` (röd
kontur över Storiden), `docs/screenshots/fas-6-bygge.png` (Visthus under
uppförande, 71 %), `docs/screenshots/fas-6-fardigt.png` (färdigt Visthus)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Byggmeny på markerad Samlare: Visthus, Krigshall, med kostnad | Klar | |
| 2. Placering med spökbild (grön/röd) och giltighetskontroll enligt GDD | Klar, med undantag | Kravet på utforskad mark kommer med krigsdimman i fas 8 |
| 3. `build`-kommando: kostnaden dras, byggplats på 10 % HP, arbetaren går dit och bygger; fler arbetare bygger snabbare; högerklick på eget bygge låter fler hjälpa till | Klar | |
| 4. Färdiga byggnader blockerar vägsökningen; Visthus är avlämningsplats | Klar | Byggen blockerar redan från placeringen |
| 5. Krigshallen kan markeras men tränar ännu inget | Klar | |

| Test i planen | Resultat |
|---|---|
| Vitest: giltig/ogiltig placering (på träd, på byggnad, utanför kartan, delvis blockerad) | Godkänt |
| Vitest: kostnad dras vid placering och nekas vid för lite trä | Godkänt |
| Vitest: en arbetare färdigställer ett Visthus på 20 s | Godkänt (exakt 400 steg, inte klart efter 399) |
| Vitest: två arbetare går fortare enligt formeln | Godkänt (267 steg för två, 200 för tre) |
| Vitest: ofärdigt Visthus tar inte emot resurser, färdigt gör det och väljs när det är närmast | Godkänt |
| Vitest: A* går runt den nya byggnaden | Godkänt, även för en enhet som redan var på väg |
| Playwright: välj Samlare → Visthus → klicka på giltig ruta → stega fram; färdigt Visthus och 80 mindre trä | Godkänt |
| Skärmdump med spökbild och färdig byggnad | Klar |

Utöver planen testas även: enhet på byggplatsen, byggnader som inte får
byggas, order utan byggare, arbetare som går till bygget, bygge utan
arbetare, hjälp till pågående bygge, arbetare som inte når bygget, ofärdig
byggnad som inte tränar, röd kontur och klick på ogiltig plats, avbrott med
högerklick och Esc, för dyr byggnad, och Krigshallen som färdig byggnad.

**Saknas eller avviker**
- **Byggplatsen behöver inte vara utforskad.** Det kravet i GDD:t kan inte
  uppfyllas förrän krigsdimman finns (fas 8).
- **Spökbilden är bara fotavtryckets kontur**, inte en bild av byggnaden.
- **Ett bygge blockerar sina rutor direkt när det placeras**, inte först
  när det är färdigt som planen säger.
- **Har man inte råd blinkar träsiffran redan när man klickar på
  byggknappen**, och placeringen startar inte.
- **Ett bygge går inte att avbryta eller riva**, och ingenting återbetalas.
  Utan arbetare står det kvar ofärdigt.
- **Arbetare blir sysslolösa när bygget är klart.** De går inte tillbaka
  till det de gjorde innan.
- **En enhet på byggplatsen gör platsen ogiltig**, även när det är den
  egna byggaren. Det följer GDD:t men kan upplevas som krångligt.
- **Arbetare som bygger kan hamna bakom byggnaden och inte synas.** På
  skärmdumpen av bygget syns en av tre.
- **Pekskärm:** byggplacering fungerar inte med finger. Det hör till fas 10.
- **Ingen garanterat fri plats för en Krigshall nära basen.**
  Kartgenereringen håller bara 4 rutor fria runt startpositionen, och en
  3×3-byggnad ryms inte där bredvid Storiden. Spelaren får hitta en plats
  själv; på standardkartan finns gott om utrymme.

**Testresultat**
- Vitest: 272 av 272
- Playwright: 58 av 58, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Enhets- och byggnadstypernas namn skrivs nu ut i `src/data/types.ts`.
  När enheter pekar på byggnader och byggnader på enheter kan TypeScript
  inte härleda namnen ur tabellerna.
- Tre tester antog en fri plats som kartgenereringen inte garanterar. Det
  är tredje gången samma slags fel uppstår; regeln står nu i
  `architecture.md` under Testgränssnitt.

### Fas 5 – Träna arbetare (2026-11-12)

**Skärmdump:** `docs/screenshots/fas-5-traning.png` (Storiden markerad,
kommandopanelen med två Samlare i kö och förloppsstapel, en fjärde Samlare
färdig)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Produktionssystem: kö (högst 5), träningstid, kostnad dras vid köning och återbetalas vid avbrott | Klar | |
| 2. Befolkningstak (30); köning nekas vid fullt tak eller för lite resurser | Klar | Enheter i kö räknas mot taket |
| 3. Ny enhet dyker upp på närmaste lediga ruta intill byggnaden | Klar | Närmast byggnadens framsida, så att den syns |
| 4. Kommandopanel: byggnad kan markeras; träningsknapp med kostnad; kö med förloppsstapel; klick på köad enhet avbryter | Klar | |
| 5. Återkoppling vid för lite resurser enligt GDD avsnitt 11 | Klar | Siffran blinkar rött i 300 ms och inget köas |

| Test i planen | Resultat |
|---|---|
| Vitest: träning drar 50 mat och ger en Samlare efter 12 s simulerad tid | Godkänt (exakt 240 steg, ingen efter 239) |
| Vitest: avbrott återbetalar | Godkänt |
| Vitest: den sjätte köningen nekas | Godkänt |
| Vitest: köning nekas vid för lite mat, utan att resurser dras | Godkänt |
| Vitest: köning nekas vid fullt befolkningstak, utan att resurser dras | Godkänt |
| Playwright: markera Storiden, klicka "Träna Samlare", stega fram; 4 egna Samlare och 50 mindre mat | Godkänt |
| Skärmdump med kommandopanel och kö | Klar |

Utöver planen testas även: att nya enheter får egna rutor framför
byggnaden, att kön tränas i ordning, avbrott av den som tränas respektive en
som väntar, ogiltiga köplatser, andra spelarens byggnad, att köade enheter
räknas mot taket, panelens placering och knappstorlek, klick på tom köplats,
och den röda blinkningen.

**Saknas eller avviker**
- **Enheter i kö räknas mot befolkningstaket.** Med 28 enheter och 2 i kö
  nekas en tredje. Planen säger bara "vid fullt befolkningstak".
- **Vid fullt befolkningstak blinkar befolkningssiffran rött.** GDD:t
  beskriver bara blinkning för resurser.
- **Full kö ger ingen återkoppling alls.** Klicket gör ingenting.
- **Träningsknappen ser likadan ut när man inte har råd.**
- **Att avbryta den enhet som tränas kastar bort arbetet** men återbetalar
  hela kostnaden.
- **Nya enheter står stilla där de dyker upp.** Samlingspunkt ingår inte i
  MVP:n.
- **Markeringen runt en vald byggnad syns dåligt.** Den gröna konturen
  ritas på marken och döljs till största delen av byggnadens block. Det har
  funnits sedan fas 3 men märks först nu när byggnaden har en funktion.
- **Smala skärmar:** kommandopanelen läggs ovanför markeringspanelen. Under
  cirka 450 px bredd får köplatserna inte plats. Mobilanpassning ligger i
  fas 10.
- **Pekskärm:** knapparna reagerar på tryck, men ett finger på en knapp
  panorerar också kameran. Det åtgärdas i fas 10.
- **Skärmdumpen visar inte den röda blinkningen.** En skärmdump tar längre
  tid än de 300 ms blinkningen varar. Färgen kontrollerades med ett
  tillfälligt bygge där blinkningen var 3 s.

**Testresultat**
- Vitest: 234 av 234
- Playwright: 51 av 51, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Kommandon ger nu tillbaka ett resultat som säger om ordern gick igenom
  och annars varför inte.
- Resursradens textfärg sattes först om varje bildruta, vilket ritar om
  texten varje gång. Nu ändras den bara när blinkningen börjar och slutar.
- Testet för den röda blinkningen läser ett tillstånd, inte pixlar. Att
  texten verkligen blir röd fick kontrolleras separat.

### Fas 4 – Resurser och insamling (2026-11-12)

**Skärmdumpar:** `docs/screenshots/fas-4-insamling.png` (två Samlare på
bär och en på trä, resursraden och markeringspanelen),
`docs/screenshots/fas-4-tomd-kalla.png` (samma plats senare: tre bärsnår
och flera träd är tömda och borta)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Resurskällor med ändlig mängd; tömda källor försvinner och träd blir gångbar mark | Klar | Även tömda bärsnår blir gångbar mark |
| 2. `gather`-kommando: källa → samla (1/s, högst 10) → avlämningsplats → upprepa; byter till närmaste källa av samma typ inom 8 rutor, annars sysslolös | Klar | Lämnar av sin sista last innan den blir sysslolös |
| 3. Spelarens lager i simuleringen; startresurser enligt GDD | Klar | 200 mat och 100 trä, för båda sidor |
| 4. HUD-överkant: mat, trä, befolkning | Klar | |
| 5. Högerklick på resurs med Samlare markerade ger `gather` | Klar | |

| Test i planen | Resultat |
|---|---|
| Vitest: en Samlare intill källa och Storide levererar exakt 10 enheter efter beräknat antal steg | Godkänt (exakt 200 steg, inget efter 199) |
| Vitest: källan minskar lika mycket som lagret ökar | Godkänt (kontrolleras varje steg i 700 steg) |
| Vitest: en tömd källa tas bort och arbetaren byter till nästa | Godkänt |
| Vitest: utan källor i närheten blir arbetaren sysslolös | Godkänt |
| Playwright: efter gather-order och framstegning visar HUD:en mer mat | Godkänt |
| Skärmdump med arbetare som samlar och HUD | Klar |

Utöver planen testas även: trä och mat hamnar i rätt lager, flera arbetare
på samma källa ställer sig på olika rutor, två arbetare som tömmer samma
källa skapar inga resurser ur intet, inneslutna träd, källor utanför
sökradien, byte av resursslag, flyttorder under insamling, sida utan
avlämningsbyggnad, klick på trädkronan, och att tömda källor försvinner
från kartan utan fel.

**Saknas eller avviker**
- **Markeringspanelen visar vad en egen enhet gör** (t.ex. "Samlar mat
  7/10"). Det står i GDD avsnitt 4 men inte i planen för någon fas.
- **Enheter som bär något får en liten färgad fyrkant.** Det står varken i
  GDD:t eller planen; utan den syns det inte att någon samlar.
- **Hur mycket som finns kvar i en källa visas ingenstans.** GDD:t kräver
  det inte.
- **Orderringen är grön även för insamling.** GDD:t anger bara grön för
  flytt och röd för attack.
- **Byte av resursslag tappar lasten.** En Samlare med 4 trä som skickas
  till bär börjar om på 0. GDD:t säger inget om det.
- **Sysslolösa arbetare syns inte på något särskilt sätt** och det finns
  ingen knapp för att hitta dem.
- **Flera arbetare kan dela ruta** när alla rutor runt en källa är upptagna.
- **Närmaste avlämningsplats räknas fågelvägen**, inte efter vägens längd.
- **Motståndaren har ett lager men gör ingenting** förrän AI:n kommer i
  fas 9.

**Testresultat**
- Vitest: 197 av 197
- Playwright: 44 av 44, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Insamlingen räknar hela simuleringssteg i stället för bråkdelar, så att
  "1 enhet per sekund" blir exakt 20 steg.
- Ett webbläsartest klickade på en enhets gamla läge efter att den redan
  hade börjat gå. Enheter rör sig i realtid även i testläge, så tester
  måste markera först och ge order sedan.

### Fas 3 – Enheter, markering och förflyttning (2026-11-12)

**Skärmdumpar:** `docs/screenshots/fas-3-markerade.png` (tre markerade
Samlare och markeringspanelen), `docs/screenshots/fas-3-dragruta.png`
(dragrutan), `docs/screenshots/fas-3-flyttorder.png` (enheter på väg)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Entiteter i simuleringen; Storide och 3 Samlare per sida vid start | Klar | Storiden är ett hinder med HP |
| 2. A* i 8 riktningar, inga genvägar över hörn, närmaste nåbara ruta vid blockerat mål | Klar | |
| 3. Kommandosystem med `move`; flera enheter sprids runt målet | Klar | |
| 4. Markering: klick, dragruta, Shift-klick, Esc; markeringsellips och orderring | Klar | |
| 5. Mjuk rörelse genom interpolation | Klar | Ingår nu, stod som saknad i fas 2 |
| 6. Markeringspanel i HUD:en (namn och HP) | Klar | |
| 7. `__TEST__.command()` och `__TEST__.tileToScreen()` | Klar | Dessutom `getSelection`, `getHud`, `getOrderMarkerCount`, `centerCameraOnTile` |

| Test i planen | Resultat |
|---|---|
| Vitest: A* hittar kortaste vägen på öppen mark | Godkänt |
| Vitest: A* går runt en mur | Godkänt |
| Vitest: A* skär inte hörn | Godkänt |
| Vitest: närmaste nåbara ruta för blockerat mål | Godkänt |
| Vitest: tom väg när målet är helt avskuret | Godkänt |
| Vitest: enhet med `move`-order står på målrutan efter förväntat antal steg | Godkänt (10 rutor = exakt 80 steg) |
| Playwright: klick på en Samlare markerar den | Godkänt |
| Playwright: dragruta över alla tre markerar tre | Godkänt |
| Playwright: högerklick får dem att stå intill rutan efter framstegning | Godkänt |
| Skärmdump med markerade enheter | Klar |

Utöver planen testas även: markeringsreglerna (Shift, byggnader,
fiendeenheter), klickträffar på enheter och byggnader, texten i
markeringspanelen, att enheter går runt byggnader och aldrig hamnar på
samma ruta, att motståndarens enheter inte lyder spelarens order, att
orderringen försvinner efter 400 ms, och att enheter rör sig i realtid.

**Saknas eller avviker**
- **Pekskärm:** markering och order fungerar inte med finger än. På mobil
  går det bara att panorera. Det står i planen för fas 10.
- **Kameran startar nu vid spelarens bas** i stället för kartans mitt. Det
  stod inte i planen för fas 3, men utan det syns inte de egna enheterna
  vid start.
- **Startenheterna är inte spegelvända mellan sidorna.** Båda sidors
  Samlare står framför sin Storide. Skillnaden är högst ett par rutor.
- **Markeringen ändras när musknappen släpps**, inte när den trycks ned.
  GDD:t säger "samma bildruta som klicket".
- **Fiendens enheter och byggnader går att markera** för att se namn och
  HP. GDD:t säger inget om det. De går inte att ge order.
- **Enheter bakom en byggnad döljs av den** men går fortfarande att klicka
  på och dra en ruta runt.
- **En orderring visas även när enheterna inte kan nå målet** och därför
  står kvar.
- **Enheter kan passera genom varandra** under förflyttning. Det är en
  uttalad förenkling i GDD:t. De stannar aldrig på samma ruta.
- **Vägar räknas inte om när kartan ändras.** Inget ändrar kartan än; det
  behövs i fas 4 och 6.
- **Skärmdumpen av flyttordern visar inte orderringen.** Den hinner tonas
  bort innan bilden tas. Ringen kontrolleras av ett webbläsartest.

**Testresultat**
- Vitest: 159 av 159
- Playwright: 37 av 37, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Första versionen placerade Samlarna bakom Storiden, där de inte syntes.
  Alla tester gick igenom ändå, eftersom testerna klickar på uträknade
  koordinater. Det upptäcktes först på skärmdumpen. Skärmdumpar ska
  granskas, inte bara sparas.
- Två webbläsartester antog att en ruta 4,1 rutor från startpositionen var
  fri. Kartgenereringen garanterar bara 4 rutor. Testerna använder nu en
  ruta som garanterat är fri.
- När målet är ett hinder valdes först den närmaste rutan med lägst index,
  så en enhet kunde gå runt till trädets baksida. Nu väljs den ruta som
  ligger närmast enheten.

### Fas 2 – Simuleringskärna och terräng (2026-11-12)

**Skärmdumpar:** `docs/screenshots/fas-2.png` (kartans mitt, frö 1),
`docs/screenshots/fas-2-startplats.png` (spelarens startplats, frö 1),
`docs/screenshots/fas-2-seed-2.png` (kartans mitt, frö 2)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. `GameState`, fast tidssteg (20 steg/s) och frösatt slumpgenerator | Klar | |
| 2. `?seed=N` styr fröet; standardfrö i `src/data/map.ts` | Klar | Ogiltigt frö ger standardfröet |
| 3. Kartgenerering: gräs, träd, bärsnår, klippa, vatten; punktspeglad; två startplatser i motsatta hörn med resurser inom 8 rutor | Klar | Spelaren i vänstra hörnet, motståndaren i högra |
| 4. Rendering av terrängen med platshållargrafik, djupsorterad | Klar | |
| 5. `__TEST__.getState()` och `__TEST__.advance(n)` | Klar | |

| Test i planen | Resultat |
|---|---|
| Vitest: samma frö ger identisk karta, olika frön olika kartor | Godkänt (40 frön ger 40 olika kartor) |
| Vitest: kartan är punktspeglad | Godkänt för 40 frön |
| Vitest: gångbar väg mellan startplatserna | Godkänt för 40 frön |
| Vitest: minst 4 bärsnår och 10 träd inom 8 rutor från varje startplats | Godkänt för 40 frön |
| Vitest: slumpgeneratorn ger samma talföljd för samma frö | Godkänt |
| Playwright: `?seed=1` och `?seed=2` ger olika kartor | Godkänt |
| Playwright: `?seed=1` ger samma karta vid två laddningar | Godkänt |
| Skärmdump av kartan med terräng | Klar |

Utöver planen testas även: fritt område runt startplatserna, att sjöar och
klippor håller avstånd till dem, reservkartan när alla försök blir avskurna,
felaktiga startplatser, tidsstegets takt vid olika bildfrekvenser, att
`advance(n)` kör exakt n steg, och att `getState()` ger en kopia.

**Saknas eller avviker**
- **Interpolation mellan simuleringssteg finns inte än.** Ingenting rör sig
  i fas 2, så den byggs i fas 3 tillsammans med enheterna (står i planen
  för fas 3).
- **Resursmängder per källa (150 mat, 100 trä) finns inte i tillståndet.**
  Kartan vet bara var träd och bärsnår står. Mängderna hör till fas 4.
- **Kameran startar fortfarande på kartans mitt**, inte vid spelarens
  startplats. Planen för fas 2 säger inget om det; det passar i fas 3 när
  Storiden finns.
- **Simuleringen går i realtid även i testläge.** `advance(n)` läggs
  ovanpå. Planen säger bara att `advance` stegar direkt.
- **Standardkartan (frö 1) har en stor skog mitt på kartan**, där två
  skogsfläckar har vuxit ihop med sina spegelbilder. Vägen mellan baserna
  går runt den. Frö 2 har ingen sådan skog. Vilket frö som ska vara
  standard kan avgöras i balansfasen.

**Testresultat**
- Vitest: 66 av 66
- Playwright: 26 av 26
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Slumpgeneratorns tillstånd ligger i `GameState`, så att ett tillstånd är
  ren data som kan kopieras och jämföras.
- Träd, bärsnår och klippor ritas som enskilda bilder med djup efter
  skärmhöjd, så att enheter i fas 3 kan gå bakom och framför dem.

### Fas 1 – Projektuppsättning, deploy och scrollbar karta (2026-11-12)

**PR:** https://github.com/boulwen90-afk/animalplanet/pull/1

**Skärmdumpar:** `docs/screenshots/fas-1.png` (kartans mitt),
`docs/screenshots/fas-1-kartkant.png` (kameran stannad vid kartans övre hörn)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Vite + TypeScript (strict) + Phaser 3, ESLint, Prettier, Vitest, Playwright | Klar | TypeScript 6.0.3 i stället för senaste 7.x, se avvikelser |
| 2. Mappstruktur enligt `tech-stack.md` | Klar | Bara mappar som fasen behöver. `public/`, `src/sim/systems/` m.fl. finns inte än |
| 3. `ci.yml` och `deploy.yml` | Delvis verifierad | `ci.yml` är grön på pull requesten. `deploy.yml` kan verifieras först efter merge och kräver att Pages är påslaget |
| 4. Isometrisk matematik i `src/sim/map/` | Klar | |
| 5. 64×64 gräsrutor som romber med synliga kanter | Klar | |
| 6. Kamera: piltangenter/WASD, kantpanorering, mittenknapp, ett finger, stannar vid kartans kant | Klar | Se avvikelse om hur "kartans kant" tolkats |
| 7. `?test=1` exponerar `window.__TEST__` med `ready` och `camera` | Klar | |

| Test i planen | Resultat |
|---|---|
| Vitest: ruta → skärm → ruta för alla hörn och mittpunkten | Godkänt (testar dessutom alla 4096 rutor) |
| Vitest: skärmpunkt mitt i en romb ger rätt ruta | Godkänt |
| Playwright: laddar utan konsolfel, `ready` blir sant | Godkänt |
| Playwright: högerpil i 500 ms ökar kamerans x | Godkänt. Farten (900 px/s) testas separat för varje tangent mot spelets egen tid |
| Playwright: kameran lämnar inte kartan efter 10 s panorering | Godkänt, i alla fyra riktningar |
| CI grön på pull requesten | Godkänt (lint, Vitest, bygge och Playwright på GitHub Actions) |
| Pages-adressen visar kartan efter merge | Deploy-jobbet godkänt efter att Pages-miljön tillåtit `main`. Själva sidan kontrolleras av användaren; Claudes session når inte github.io |
| Skärmdump av kartan | Klar |

Utöver planen testas även: WASD, kantpanorering, drag med mittenknapp, att
vänsterknappen inte flyttar kameran, drag med ett finger, och att
`window.__TEST__` saknas utan `?test=1`.

**Saknas eller avviker**
- **Publiceringen är inte verifierad.** Den går inte att testa förrän
  pull requesten är mergad och GitHub Pages är påslaget (Settings → Pages →
  Source: "GitHub Actions").
- **Kamerans gräns.** Planen säger att kameran stannar vid kartans kant.
  Implementationen håller bildens mittpunkt inom kartromben, så upp till
  halva bilden (tre fjärdedelar i ett hörn) kan visa tomrum utanför kartan.
  Skäl: kartan är en romb, och en rektangulär gräns visade nästan bara tomrum
  i hörnen.
- **TypeScript 6.0.3** i stället för 7.x, eftersom typescript-eslint inte
  stöder 7 ännu.
- **Branchnamn.** Fasen ligger på `claude/compassionate-archimedes-ztanms`
  (namnet tilldelas av Claude Code-sessionen), inte på en branch med fasnamn.
- **`deploy.yml` kör inte Playwright**, bara lint, Vitest och bygge.
  Playwright körs på pull requesten.
- `npm audit` rapporterar en sårbarhet av måttlig grad i `minimatch`, som
  dras in av ESLint-verktygen. Den finns bara i utvecklingsverktygen och
  följer inte med i det publicerade spelet.

**Testresultat**
- Vitest: 20 av 20
- Playwright: 19 av 19, även med webbläsaren nedbromsad 8 och 16 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga (WebGL-renderare)

**Beslut och lärdomar**
- Phaser begränsar sitt `delta` till 1/60 s under de första 120 bildrutorna
  och när sidan saknar fokus. I headless-webbläsaren (ca 20 bilder/s) gick
  kameran därför med 300 px/s i stället för 900. Kameran räknar nu på verklig
  tid mellan bildrutor. Simuleringens tidssteg i fas 2 måste göra likadant.
- Kartrutorna ritas med en Blitter: 4096 rutor i ett ritanrop.
- CI gick igenom en gång och fallerade nästa, utan kodändring emellan. Två
  tester mätte kamerans fart mot väggklockan. GitHub-maskinerna ritar
  långsammare än 10 bilder/s, och eftersom varje bildruta räknas som högst
  100 ms gick kameran då långsammare i verklig tid (180 och 270 px på 500 ms
  i stället för 450). Felet återskapades lokalt med nedbromsad webbläsare.
  Testerna mäter nu fart mot spelets egen tid (`__TEST__.elapsedMs`).
  Tester i kommande faser ska stega simuleringen i stället för att vänta
  på verklig tid.

## Kända problem

_Inga öppna._

### Lösta

- **Publiceringen till GitHub Pages avvisades (fas 1, löst 2026-11-12).**
  Deploy-jobbet på `main` stoppades inom två sekunder, innan någon maskin
  tilldelats och utan loggar. Repots första push gjorde sessionsbranchen
  till standardbranch, och miljön `github-pages` tillåter som standard bara
  den branch som var standard när Pages slogs på. Regeln följer inte med
  när standardbranchen byts. Lösning: `main` lades till under Settings →
  Environments → `github-pages` → Deployment branches and tags. Därefter
  gick publiceringen igenom.
