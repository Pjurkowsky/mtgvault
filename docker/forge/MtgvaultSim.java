// MTG Vault's Forge runner (spec 024). Plays one Commander game between AI players and writes
// what happened as JSON lines: a step per game log entry, with the board whenever it changed,
// then the result. Compiled against an official Forge release; Forge itself is unchanged.
//
// java -cp forge.jar:. MtgvaultSim --out game.jsonl --timeout 300 --seed 7 --lookahead normal a.dck:Default b.dck:Reckless
// The first deck goes first; turns follow the order given. --lookahead is off, light, normal or max (spec 029).

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import com.google.gson.Gson;

import forge.GuiDesktop;
import forge.ai.LobbyPlayerAi;
import forge.ai.PlayerControllerAi;
import forge.deck.Deck;
import forge.deck.io.DeckSerializer;
import forge.game.*;
import forge.game.card.Card;
import forge.game.card.CounterType;
import forge.game.combat.Combat;
import forge.game.player.Player;
import forge.game.player.RegisteredPlayer;
import forge.game.zone.ZoneType;
import forge.gui.GuiBase;
import forge.model.FModel;
import forge.util.MyRandom;
import forge.view.TimeLimitedCodeBlock;

public class MtgvaultSim {
    static final Gson GSON = new Gson();
    static final Set<GameLogEntryType> SKIP = EnumSet.of(GameLogEntryType.PHASE, GameLogEntryType.MANA);

    /** An AI that always lets the first seat start, so the caller decides who goes first. */
    static class SeatedAi extends LobbyPlayerAi {
        SeatedAi(String name) { super(name, null); }

        @Override
        public Player createIngamePlayer(Game game, int id) {
            Player ai = new Player(getName(), game, id);
            ai.setFirstController(new PlayerControllerAi(game, ai, this) {
                @Override
                public Player chooseStartingPlayer(boolean isFirstGame) { return game.getPlayers().get(0); }
            });
            return ai;
        }
    }

    public static void main(String[] args) throws Exception {
        System.setProperty("java.awt.headless", "true");
        System.setProperty("java.util.Arrays.useLegacyMergeSort", "true");
        String out = null;
        int timeout = 300;
        Long seed = null;
        String lookahead = "off";
        List<String[]> seats = new ArrayList<>();
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--out" -> out = args[++i];
                case "--timeout" -> timeout = Integer.parseInt(args[++i]);
                case "--seed" -> seed = Long.parseLong(args[++i]);
                case "--lookahead" -> lookahead = args[++i];
                default -> {
                    int colon = args[i].lastIndexOf(':');
                    seats.add(colon > 0 ? new String[] {args[i].substring(0, colon), args[i].substring(colon + 1)} : new String[] {args[i], "Default"});
                }
            }
        }
        if (out == null || seats.size() < 2) {
            System.err.println("usage: MtgvaultSim --out file [--timeout s] [--seed n] [--lookahead off|light|normal|max] deck.dck[:Profile] ...");
            System.exit(2);
        }

        GuiBase.setInterface(new GuiDesktop());
        FModel.initialize(null, null);
        if (seed != null) MyRandom.setRandom(new Random(seed));

        List<RegisteredPlayer> players = new ArrayList<>();
        for (String[] seat : seats) {
            Deck deck = DeckSerializer.fromFile(new File(seat[0]));
            if (deck == null) fail(out, "Could not load deck " + seat[0]);
            RegisteredPlayer rp = RegisteredPlayer.forCommander(deck);
            SeatedAi ai = new SeatedAi(deck.getName());
            ai.setAiProfile(seat[1]);
            rp.setPlayer(ai);
            players.add(rp);
        }

        GameRules rules = new GameRules(GameType.Commander);
        rules.setAppliedVariants(EnumSet.of(GameType.Commander));
        Match match = new Match(rules, players, "MTG Vault");
        Game game = match.createGame();
        game.setNoGUIUser();
        // Forge's HostedMatch sets these from its preferences; this runner builds the Match itself (spec 029, AC-3).
        game.AI_FLAT_MONTE_CARLO = !"off".equals(lookahead);
        game.AI_FLAT_MONTE_CARLO_LITE = "light".equals(lookahead);
        game.AI_FLAT_MONTE_CARLO_MAX = "max".equals(lookahead);

        try (PrintWriter w = new PrintWriter(new FileWriter(out))) {
            Recorder rec = new Recorder(game, w);
            game.getGameLog().addObserver((o, arg) -> rec.onLog());
            String status = "won";
            String error = null;
            try {
                TimeLimitedCodeBlock.runWithTimeout(() -> match.startGame(game), timeout, TimeUnit.SECONDS);
            } catch (TimeoutException e) {
                status = "draw";
                error = "timeout";
            } catch (Exception | StackOverflowError e) {
                status = "failed";
                error = e.toString();
            }
            rec.onLog();
            GameOutcome outcome = game.getOutcome();
            Integer winner = null;
            if ("won".equals(status)) {
                if (outcome == null || outcome.isDraw()) {
                    status = outcome == null ? "failed" : "draw";
                } else {
                    winner = seatOf(game, outcome.getWinningLobbyPlayer().getName());
                }
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", status);
            result.put("winner_seat", winner);
            result.put("turn", game.getPhaseHandler().getTurn());
            result.put("lost_on", rec.lostOn);
            result.put("error", error);
            List<String> names = new ArrayList<>();
            for (Player p : game.getRegisteredPlayers()) names.add(p.getName());
            result.put("players", names);
            List<String> log = new ArrayList<>();
            List<GameLogEntry> entries = game.getGameLog().getLogEntries(null);
            Collections.reverse(entries);
            for (GameLogEntry e : entries) log.add(e.toString());
            result.put("log", log);
            w.println(GSON.toJson(Map.of("result", result)));
        }
        System.exit(0);
    }

    static void fail(String out, String error) throws Exception {
        try (PrintWriter w = new PrintWriter(new FileWriter(out))) {
            w.println(GSON.toJson(Map.of("result", Map.of("status", "failed", "error", error))));
        }
        System.exit(1);
    }

    static int seatOf(Game game, String name) {
        List<Player> all = game.getRegisteredPlayers();
        for (int i = 0; i < all.size(); i++) if (all.get(i).getName().equals(name)) return i;
        return -1;
    }

    /** Writes a step for each new log entry, with the board when it changed. */
    static class Recorder {
        final Game game;
        final PrintWriter w;
        int seen = 0;
        String lastBoard = "";
        final Map<Integer, Integer> lostOn = new TreeMap<>();

        Recorder(Game game, PrintWriter w) { this.game = game; this.w = w; }

        synchronized void onLog() {
            List<GameLogEntry> all = game.getGameLog().getLogEntries(null); // newest first
            int total = all.size();
            if (total <= seen) return;
            List<GameLogEntry> fresh = new ArrayList<>(all.subList(0, total - seen));
            Collections.reverse(fresh);
            seen = total;
            int turn = game.getPhaseHandler().getTurn();
            Player active = game.getPhaseHandler().getPlayerTurn();
            for (Player p : game.getRegisteredPlayers()) {
                if (p.hasLost() && !lostOn.containsKey(seatOf(game, p.getName()))) lostOn.put(seatOf(game, p.getName()), turn);
            }
            for (GameLogEntry e : fresh) {
                if (SKIP.contains(e.type())) continue;
                Map<String, Object> step = new LinkedHashMap<>();
                step.put("turn", turn);
                step.put("active", active == null ? null : seatOf(game, active.getName()));
                step.put("type", e.type().name());
                step.put("text", e.message());
                String board = GSON.toJson(board());
                if (!board.equals(lastBoard)) {
                    step.put("board", board());
                    lastBoard = board;
                }
                w.println(GSON.toJson(step));
            }
            w.flush();
        }

        List<Map<String, Object>> board() {
            List<Map<String, Object>> seats = new ArrayList<>();
            for (Player p : game.getRegisteredPlayers()) {
                Map<String, Object> s = new LinkedHashMap<>();
                s.put("life", p.getLife());
                s.put("lost", p.hasLost());
                s.put("hand", p.getCardsIn(ZoneType.Hand).size());
                s.put("library", p.getCardsIn(ZoneType.Library).size());
                s.put("hand_cards", cards(p, ZoneType.Hand, false));
                s.put("library_cards", cards(p, ZoneType.Library, false)); // top card first
                s.put("battlefield", cards(p, ZoneType.Battlefield, true));
                s.put("graveyard", cards(p, ZoneType.Graveyard, false));
                s.put("exile", cards(p, ZoneType.Exile, false));
                s.put("command", cards(p, ZoneType.Command, false));
                seats.add(s);
            }
            return seats;
        }

        List<Map<String, Object>> cards(Player p, ZoneType zone, boolean detail) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Card c : p.getCardsIn(zone)) {
                if (zone == ZoneType.Command && !c.isCommander()) continue;
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", c.getId());
                m.put("name", c.isFaceDown() ? "Face-down card" : c.getName());
                if (detail) {
                    m.put("row", c.isCreature() ? "creature" : c.isLand() ? "land" : "other");
                    if (c.isTapped()) m.put("tapped", true);
                    if (c.isToken()) m.put("token", true);
                    if (c.isCreature()) {
                        m.put("power", c.getNetPower());
                        m.put("toughness", c.getNetToughness());
                    }
                    Map<String, Integer> counters = new TreeMap<>();
                    for (com.google.common.collect.Multiset.Entry<CounterType> e : c.getCounters().entrySet()) counters.put(e.getElement().getName(), e.getCount());
                    if (!counters.isEmpty()) m.put("counters", counters);
                    if (c.getAttachedTo() != null) m.put("attached_to", c.getAttachedTo().getId());
                    if (c.getOwner() != c.getController()) m.put("owner", seatOf(game, c.getOwner().getName()));
                    combat(c, m);
                }
                out.add(m);
            }
            return out;
        }

        /** Marks an attacker with what it attacks and a blocker with the attackers it blocks. */
        void combat(Card c, Map<String, Object> m) {
            Combat combat = game.getCombat();
            if (combat == null) return;
            if (combat.isAttacking(c)) {
                GameEntity target = combat.getDefenderByAttacker(c);
                if (target instanceof Player) m.put("attacking", Map.of("seat", seatOf(game, ((Player) target).getName())));
                else if (target instanceof Card) m.put("attacking", Map.of("card", ((Card) target).getId()));
            }
            if (combat.isBlocking(c)) {
                List<Integer> ids = new ArrayList<>();
                for (Card a : combat.getAttackersBlockedBy(c)) ids.add(a.getId());
                if (!ids.isEmpty()) m.put("blocking", ids);
            }
        }
    }
}
