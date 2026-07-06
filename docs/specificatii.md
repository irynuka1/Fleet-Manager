# SPECIFICATIA CERINTELOR

## Platforma de Management si Telemetrie Flota Auto / Utilaje (SaaS) — **OmniKinetix**

---

## 1. INTRODUCERE

### 1.1. Scopul documentului
Acest document defineste cerintele functionale si nefunctionale pentru sistemul informatic "OmniKinetix". Scopul este de a oferi o descriere detaliata a arhitecturii sistemului, a modului de interactiune a utilizatorilor cu interfata web (Desktop) si a proceselor asincrone (telemetrie GPS in timp real si alerte de mentenanta/documente), servind drept ghid pentru etapele de dezvoltare.

### 1.2. Domeniul/contextul de utilizare al sistemului
Sistemul este destinat companiilor care opereaza flote auto medii si mari: firme de logistica si distributie, companii de curierat, servicii de rent-a-car si firmele de constructii care gestioneaza atat autovehicule clasice, cat si utilaje. Platforma va elimina necesitatea gestionarii manuale a reviziilor, va automatiza avertizarile legale (ITP, RCA) si va oferi monitorizare geografica in timp real a intregului parc auto, indiferent de tipul vehiculului.

### 1.3. Lista de definitii si abrevieri
- **SaaS**: Software as a Service.
- **Multi-Tenant**: Arhitectura in care o singura instanta deserveste mai multe Agentii / Companii.
- **CRON**: Utilitar pentru planificarea executiei unor sarcini pe server la intervale regulate.
- **OSM**: OpenStreetMap, serviciu cartografic utilizat pentru randarea hartii in frontend.
- **WSS**: WebSocket Secure, protocol pentru comunicare bidirectionala in timp real.

---

## 2. DESCRIERE GENERALA

### 2.1. Scurta descriere a sistemului
Platforma este o aplicatie web care centralizeaza managementul vehiculelor, utilajelor si documentelor acestora pe filiale/agentii. Platforma va elimina necesitatea gestionarii manuale a reviziilor, va automatiza avertizarile legale (ITP, RCA) notificand utilizatorii si va oferi monitorizare geografica in timp real a intregului parc auto, indiferent de tipul vehiculului.

### 2.2. Motivatie (de ce este necesar)
Gestionarea clasica a parcurilor auto se face defectuos, generand costuri neprevazute masive (amenzi pentru documente expirate, uzura necontrolata, utilizarea vehiculelor in afara orelor de program). Acest sistem automatizeaza vigilenta administrativa si ofera control vizual imediat.

### 2.3. Produse similare
**Nexus GPS Tracking / WebEye / Frotcom**: Sunt platforme consacrate, dar prezinta dezavantaje majore: costuri de licentiere masive pe fiecare vehicul, interfete invechite (legacy) si dependenta de echipamente hardware proprietare foarte scumpe. Sistemul nostru propune o abordare moderna, decuplata hardware, bazata pe tehnologii web de ultima generatie (Node.js/React).

### 2.4. Riscurile proiectului
- **Competitie**: Existenta unor solutii complexe pe piata poate face dificila adoptia comerciala initiala.
- **Tehnologice**: Randarea fluida a unui numar mare de masini/utilaje simultan pe harta OSM necesita optimizarea pachetelor de date trimise prin WebSockets.
- **De planificare**: Complexitatea implementarii conceptului de "Multi-Tenant" cu 3 ierarhii de roluri intr-un timp relativ scurt (3 sprint-uri).
- **Factori de experienta**: Necesitatea ca echipa sa invete asincronicitatea Node.js si conexiunile Socket.io.
- **Externi**: Posibile intreruperi de conexiune la internet pe santiere, intarziind datele de telemetrie.

---

## 3. SISTEMUL PROPUS

### 3.1. Descrierea categoriilor de utilizatori

| Rol | Cum utilizeaza | Competente | Numar / Frecventa |
|-----|---------------|------------|-------------------|
| **Super Administrator (SuperAdmin)** | Creeaza conturile pentru agentii/companii din sistem si administreaza platforma la nivel de infrastructura. | Nivel IT mediu-avansat | 1-2 utilizatori / Lunar |
| **Manager pe Tara (Country Manager)** | Vizualizeaza, adauga si modifica date in TOATE agentiile asociate companiei. Foloseste harta pentru a vedea toata flota. Primeste alerte din toate agentiile. | Operare PC de baza | 1-5 utilizatori / Zilnic |
| **Manager de Agentie (Agency Manager)** | Vizualizeaza, adauga si modifica date in agentia lui. Foloseste harta pentru a vedea masinile alocate pe agentia lui si primeste alerte doar din agentia lui. | Operare PC de baza | 1-20 utilizatori / Zilnic |

### 3.2. Cerinte de sistem
- **Echipamente de calcul (Server)**: Masina virtuala (VPS) cu mediu Node.js si baza de date PostgreSQL.
- **Dispozitive (Clienti)**: PC/Laptop (Browser modern) pentru dashboard-ul Web/Aplicatia desktop, respectiv Smartphone Android pentru monitorizare in teren.
- **Comunicatia in retea**: Conexiune HTTP/REST pentru adaugarea de date (CRUD) si conexiune WSS (WebSocket) persistenta pentru Live Map.

### 3.3. Cerinte functionale
1. Sistemul trebuie sa permita gestiunea (CRUD) vehiculelor si utilajelor, a soferilor si a documentelor acestora.
2. Sistemul trebuie sa primeasca coordonate GPS in timp real (pentru testare, de la un simulator extern) si sa randeze locatia fiecarui vehicul pe o harta OpenStreetMap.
3. Sistemul va permite managerilor introducerea manuala a orelor de functionare (utilaje) sau a kilometrajului (auto) la intervale regulate.
4. Sistemul va rula job-uri asincrone zilnice pentru a emite alerte pe email / in interfata / pe telefon privind expirarea politelor RCA.

### 3.4. Cerinte nefunctionale
- **Constrangeri Hardware/Software**: Sistemul va fi dezvoltat integral in TypeScript (Full-Stack). Baza de date trebuie sa ruleze PostgreSQL cu extensia PostGIS instalata pentru a gestiona tipul de date spatiale.
- **Constrangeri de Comunicare**: Timpul de latenta (de la primirea coordonatei GPS pe server pana la miscarea utilajului in browser-ul clientului) nu trebuie sa depaseasca 1.5 secunde.

### 3.5. Modele ale sistemului

#### 3.5.1. Actorii si cazurile de utilizare
- **Actori**: SuperAdmin, ManagerTara, ManagerAgentie, EnginePredictiv (CRON Intern).
- **Cazuri de utilizare**: Management Resurse, Monitorizare Harta Live, Procesare Alerte.

#### 3.5.2. Descrierea cazurilor de utilizare

---

##### Cazul de Utilizare 1: Management Resurse (Grupari Custom, Vehicule si Istoric Rulaj)

**Actori implicati**: ManagerAgentie, ManagerTara, SuperAdmin.

**Preconditie**: Utilizatorul este autentificat cu rol de management pe agentia selectata.

**Postconditie**: Baza de date este actualizata cu noi categorii custom, vehicule noi sau editari ale rulajului/actelor (ITP/RCA).

**Fluxul de baza**:
1. Utilizatorul acceseaza modulul "Management Flota".
2. Sistemul afiseaza vehiculele grupate pe categorii custom definite de utilizator (ex: "Utilaje", "Masini Angajati").
3. Utilizatorul poate crea un Grup Nou (subtitlu) apasand "Adauga Categorie".
4. Pentru a inregistra o masina, utilizatorul apasa "Adauga Vehicul".
5. Se deschide un Pop-up (Fereastra Modala) unde completeaza: Nume, Numar Inmatriculare, alege Categoria (din cele create anterior) si selecteaza cu un switch/toggle tipul de monitorizare: Kilometri sau Ore de functionare.
6. Pentru a modifica, utilizatorul apasa "Editare" pe un vehicul existent. Pop-up-ul se redeschide, permitand actualizarea numarului de kilometri/ore (pentru revizie) si modificarea datelor limita pentru noile polite RCA si ITP.
7. Datele sunt trimise (POST/PUT) catre API-ul Node.js.
8. API-ul salveaza/actualizeaza si returneaza succes (HTTP 201/200).
9. Interfata grafica isi da refresh automat (fara reincarcarea paginii), afisand datele in grupul corect.

**Alternativele la fluxul de baza**:
- Daca numarul de inmatriculare exista deja, API-ul returneaza eroare ("Vehicul Duplicat").

**Schita interfetei utilizator**: Pagina este impartita in sectiuni expandabile (Acordeoane) reprezentand categoriile custom. Fiecare sectiune contine un mini-tabel cu vehiculele aferente. Exista un buton global de "+ Adauga Categorie" si butoane de "+ Adauga Vehicul" in dreptul fiecarui subtitlu. Pop-up-ul de editare este impartit in tab-uri (ex: Tab "General", Tab "RCA/ITP", Tab "Mentenanta").

**Prioritatea la implementare**: Critica — Arhitectura datelor si UX-ul principal depind 100% de flexibilitatea acestui modul.

---

##### Cazul de Utilizare 2: Procesare si Alertare (ITP, RCA, Limita Revizii)

**Actori implicati**: EngineAlerte (CRON intern), ServiciuSMTP (Extern), ManagerAgentie (Web).

**Preconditie**: Masinile au introduse in sistem documente (ITP/RCA) cu date de expirare si o limita de revizie setata (ex: 15.000 km sau 500 ore). Managerul actualizeaza periodic rulajul curent.

**Postconditie**: Daca pragurile sunt incalcate, alertele sunt salvate in baza de date (pentru a aparea instant in aplicatia web) si se trimite un singur e-mail centralizat.

**Fluxul de baza**:
1. CRON-ul se declanseaza automat pe server in fiecare zi la ora 11:00 AM.
2. Sistemul face un query in baza de date pentru actele scadente: cauta documente unde `data_expirare - data_curenta < 30 zile`.
3. Sistemul face un query pentru revizii: cauta vehicule unde `rulaj_curent >= limita_revizie`.
4. Daca se gasesc nereguli (exista cel putin o alerta), sistemul salveaza aceste notificari in baza de date, asociate Managerului.
5. Sistemul impinge un request catre serviciul SMTP pentru a trimite lista pe email.
6. Managerul primeste email-ul.
7. Cand managerul deschide aplicatia web, sistemul interogheaza notificarile si afiseaza clopotelul rosu cu alerte.

**Alternativele la fluxul de baza**:
- **A1**: Daca in urma query-urilor (pasii 2 si 3) nu se gaseste nicio neregula, CRON-ul isi incheie executia in liniste, fara a contacta baza de date pentru salvari suplimentare sau serverul SMTP.
- **A2**: Daca serviciul SMTP (de email) este cazut, eroarea este tratata in fundal. Alertele raman salvate in baza de date, deci managerul tot va fi notificat in aplicatia web cand o deschide.

**Prioritate la implementare**: Critica (Ofera cea mai mare valoare de business companiei, prevenind amenzile).

**Schita interfetei utilizator**: In aplicatia web, in coltul dreapta-sus, exista o iconita de clopotel. Daca sunt alerte, are un badge rosu cu un numar (ex: "3"). La apasare, se deschide o lista cu alertele.

---

##### Cazul de Utilizare 3: Monitorizare Harta Live

**Actori implicati**: ManagerAgentie, ManagerTara, SimulatorGPS (hardware/script emitator).

**Preconditie**: Vehiculele sunt inregistrate in sistem, iar utilizatorul vizualizeaza sectiunea "Harta Live". Conexiunea WebSocket este stabilita cu succes.

**Postconditie**: Marcajele vehiculelor (masini/utilaje) isi schimba pozitia fluid pe OpenStreetMap, reflectand locatia reala.

**Fluxul de baza**:
1. (pentru testare) Simulatorul GPS trimite la fiecare 5 secunde un payload JSON format din: `{ id_vehicul, lat, lng }`.
2. Serverul Node.js primeste coordonatele si le salveaza rapid in tabela `TELEMETRY_LIVE`.
3. Serverul emite aceste date prin protocolul WebSocket strict catre utilizatorii abonati in "camera" agentiei corespunzatoare masinii.
4. Aplicatia client (React/Leaflet.js) translateaza coordonatele sferice in pixeli (Proiectia Web Mercator) si misca animat marker-ul pe ecran.

**Alternativele la fluxul de baza**:
- **A1**: Daca o masina nu a mai trimis un ping GPS de mai mult de 5 minute, marker-ul de pe harta isi schimba culoarea din verde in gri (Status: Offline/Fara Semnal).
- **A2**: In caz de cadere a conexiunii Socket.io in browser, sistemul client va incerca un mecanism de HTTP Long-Polling pana cand conexiunea principala se restabileste.

**Schita interfetei utilizator**: Layout de tip "Split Screen". In stanga (20% din ecran), o lista a flotei cu statusul conectivitatii (Online/Offline) si buton de "Focus". In dreapta (80% din ecran), harta interactiva OpenStreetMap (zoom, pan) cu iconite personalizate (dube pentru vehicule, excavatoare pentru utilaje).

**Prioritatea la implementare**: Medie — Ofera avantajul competitiv vizual si tehnic al platformei (Real-Time Tracking).

---

## 4. DECIZII TEHNICE SI CLARIFICARI

### 4.1. Stack Tehnologic

| Component | Tehnologie |
|-----------|-----------|
| Backend | Node.js + Express + TypeScript + Prisma + Socket.io |
| Frontend Web | React + Vite + Shadcn/ui + Tailwind CSS + Leaflet.js + TypeScript |
| Baza de date | PostgreSQL + PostGIS |
| Autentificare | JWT (access token 15min + refresh token 7 zile) |
| Email | Nodemailer + SMTP |
| CRON | node-cron |
| Harti | OpenStreetMap tiles + Leaflet.js |
| Simulator GPS | Script Node.js custom |

### 4.2. Arhitectura

- **Monorepo** cu npm workspaces: `apps/api`, `apps/web`, `tools/gps-simulator`
- **Single-company database** — fara `company_id`. Izolarea se face doar prin `agency_id`.
- **Desktop** = aplicatia web deschisa in browser (fara Electron).
- **Limba interfetei**: Romana fara diacritice.
- **Tema**: Light + Dark mode cu toggle.

### 4.3. Clarificari Business

- **Categorii vehicule**: Globale (vizibile in toate agentiile).
- **Relatie sofer-vehicul**: Many-to-Many, fara restrictii. Un sofer poate fi asignat la mai multe vehicule simultan, un vehicul poate avea mai multi soferi.
- **Revizie**: Managerul seteaza pragul absolut de km/ore la care trebuie facuta revizia (ex: revizie la 77.000 km). Alerta se emite la 1.000 km/ore inainte de prag.
- **Creare conturi**: Doar SuperAdmin creeaza conturi (nu exista self-registration).
- **Panou SuperAdmin**: Panel dedicat cu management agentii + management useri.
- **Documente soferi**: Permis de conducere + Fisa medicala (cu date de expirare + upload fisier scanat PDF/imagine).
- **Alerte**: Atat ITP cat si RCA, plus limita revizie.
- **Telemetrie**: Pozitie live + istoric traseu cu playback.

### 4.4. Plan Sprint-uri

| Sprint | Livrabil |
|--------|----------|
| **Sprint 1** | Auth + CRUD complet (Management Resurse) + Panel SuperAdmin |
| **Sprint 2** | Documente ITP/RCA + Alerte CRON + Notificari in-app |
| **Sprint 3** | Harta Live + Playback traseu |
