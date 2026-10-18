# uptimerobot-stickies

Karteczka na pulpit macOS ([Übersicht](https://tracesof.net/uebersicht/)) pokazująca
stan monitorów z **publicznej strony statusu [UptimeRobot](https://uptimerobot.com)** —
zarówno `https://stats.uptimerobot.com/<klucz>`, jak i strony pod własną domeną
(np. `status.example.com`).

- 🔴 monitor leży · 🟡 dostępność z 30 dni < 99% (albo nieznany stan) · ⏸ wstrzymany · 🟢 OK
- kolumny: dostępność z 30 i 90 dni; klik w wiersz otwiera stronę statusu,
  dymek pokazuje typ monitora i ostatnią awarię
- odświeżanie co 5 min, ⟳ = teraz; ▾ zwija, ✕ zostawia pinezkę 📌
- przeciąganie myszą, wysokość listy zmieniasz chwytając dolną krawędź (dwuklik = auto)
- **offline**: gdy nie ma sieci, karteczka pokazuje ostatnie pobrane dane z dopiskiem 📴

Nie trzeba klucza API — strona statusu udostępnia publicznie JSON
(`/api/getMonitorList/<klucz>`), a klucz skrypt odczytuje z HTML strony.
Tylko biblioteka standardowa Pythona (3.9+).

## Instalacja

```sh
git clone https://github.com/mpasternak/uptimerobot-stickies.git
cd uptimerobot-stickies
python3 uptime_status.py https://stats.uptimerobot.com/AbC123   # test w terminalu
./install.sh https://stats.uptimerobot.com/AbC123 "Uptime" 1210 720
```

Potem w Übersicht: ⌘R (Refresh All Widgets).

`./install.sh URL [TYTUŁ] [LEFT] [TOP] [AKCENT]` — kilka stron statusu to kilka
wywołań z różnymi tytułami (tytuł wyznacza nazwę pliku `uptimerobot-<tytuł>.jsx`).
Inny Python: `PYTHON=/ścieżka/python3 ./install.sh …`.

## Testy

```sh
pip install pytest ruff
pytest -q && ruff check . && ruff format --check .
```

## Licencja

MIT
