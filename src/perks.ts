/// <reference path="./trimps.ts"/>

class Perk {
	locked = true;
	level = 0;
	min_level = 0;
	cost = 0;
	gain = 0;
	bonus = 1;

	constructor(
		private base_cost: number,
		public cost_increment: number,
		private scaling: (level: number) => number,
		public max_level: number = Infinity,
		private cost_exponent: number = 1.3,
	) {
		this.cost = this.base_cost;
	}

	levellable(ra_left: number): boolean {
		return !this.locked &&
			this.level < this.max_level &&
			this.cost * max(1, floor(this.level / 1e12)) <= ra_left;
	}

	level_up(amount: number): number {
		this.level += amount;
		this.bonus = this.scaling(this.level);
		if (this.cost_increment) {
			let spent = amount * (this.cost + this.cost_increment * (amount - 1) / 2);
			this.cost += amount * this.cost_increment;
			return spent;
		} else {
			let spent = this.cost;
			this.cost = ceil(this.level / 2 + this.base_cost * pow(this.cost_exponent, this.level));
			return spent;
		}
	}

	spent(log: boolean = false) {
		if (this.cost_increment)
			return this.level * (this.base_cost + this.cost - this.cost_increment) / 2;
		let total = 0;
		for (let x = 0; x < this.level; ++x)
			total += ceil(x / 2 + this.base_cost * pow(this.cost_exponent, x));
		return total;
	}

	log_ratio(): number {
		return this.cost_increment ? (this.scaling(1) - this.scaling(0)) / this.bonus
		                           : log(this.scaling(this.level + 1) / this.bonus);
	}
}

function validate_fixed() {
	try {
		parse_perks($('#fixed').value, 'l');
		$('#fixed').setCustomValidity('');
	} catch (err) {
		$('#fixed').setCustomValidity(err);
	}
}

let presets: {[key: string]: string[]} = {
	early:       [  '5',  '4',  '3'],
	broken:      [  '7',  '3',  '1'],
	mid:         [ '16',  '5',  '1'],
}

function select_preset(name: string, manually: boolean = true) {
	delete localStorage['weight-he'];
	delete localStorage['weight-atk'];
	delete localStorage['weight-hp'];
	delete localStorage['weight-xp'];
	[$('#weight-he').value, $('#weight-atk').value, $('#weight-hp').value] = presets[name];
	$('#weight-xp').value = floor((+presets[name][0] + +presets[name][1] + +presets[name][2]) / 5).toString();
}

function auto_preset() {
	let [he, atk, hp] = presets[$('#preset').value];
	let xp = floor((+he + +atk + +hp) / 5).toString();
	$('#weight-he').value = localStorage['weight-he'] || he;
	$('#weight-atk').value = localStorage['weight-atk'] || atk;
	$('#weight-hp').value = localStorage['weight-hp'] || hp;
	$('#weight-xp').value = localStorage['weight-xp'] || xp;
}

function handle_respec(respec: boolean) {
	let owned = game ? game.resources.radon.owned : 0;
	$('#radon').value = (input('radon') + owned * (respec ? -1 : 1)).toString();
}

function read_save() {
	// Auto-fill for the lazy
	if (!localStorage.zone)
		$('#zone').value = game.stats.highestVoidMap2.valueTotal || game.global.highestRadonLevelCleared;
	let zone = input('zone');

	if (!localStorage.preset) {
		$$('#preset > *').forEach(function (option: HTMLOptionElement) {
			option.selected = parseInt(option.innerHTML.replace('z', '')) < game.global.highestRadonLevelCleared;
		});
		auto_preset();
	}

	// Rn / unlocks
	let radon = game.global.radonLeftover;
	for (let perk in game.portal)
		radon += (game.portal[perk].radSpent || 0);

	let unlocks = Object.keys(game.portal).filter(perk => !game.portal[perk].locked);
	if (!game.global.canRespecPerks)
		unlocks = unlocks.map(perk => perk + '>' + (game.portal[perk].level || 0));

	// Income
	let tt = mastery('turkimp2') ? 1 : mastery('turkimp') ? 0.4 : 0.25;
	let prod = 1 + tt;
	let loot = 1 + 0.333 * tt;

	let chronojest = 27 * game.unlocks.imps.Jestimp + 15 * game.unlocks.imps.Chronoimp;
	let cache = zone < 60 ? 0 : zone < 85 ? 7 : zone < 160 ? 10 : zone < 185 ? 14 : 20;

	for (let mod of (game.global.StaffEquipped.mods || [])) {
		if (mod[0] === 'MinerSpeed')
			prod *= 1 + 0.01 * mod[1];
		else if (mod[0] === 'metalDrop')
			loot *= 1 + 0.01 * mod[1];
	}

	chronojest += (mastery('mapLoot2') ? 5 : 4) * cache;

	// Fill the fields
	$('#radon').value = radon + ($('#respec').checked ? 0 : game.resources.radon.owned);
	$('#unlocks').value = unlocks.join(',');
	$('#whipimp').checked = game.unlocks.imps.Whipimp;
	$('#magnimp').checked = game.unlocks.imps.Magnimp;
	$('#tauntimp').checked = game.unlocks.imps.Tauntimp;
	$('#venimp').checked = game.unlocks.imps.Venimp;
	$('#chronojest').value = prettify(chronojest);
	$('#prod').value = prettify(prod);
	$('#loot').value = prettify(loot);
	$('#breed-timer').value = prettify(mastery('patience') ? 45 : 30);
}

function parse_inputs() {
	let preset = $('#preset').value;

	let result = {
		total_ra: input('radon'),
		zone: parseInt($('#zone').value),
		perks: parse_perks($('#fixed').value, $('#unlocks').value),
		weight: {
			radon: input('weight-he'),
			attack: input('weight-atk'),
			health: input('weight-hp'),
			xp: input('weight-xp'),
			trimps: input('weight-trimps'),
			income: 0,
		},
		scruffy: {
			xp: game ? game.global.fluffyExp2 : 0,
			prestige: game ? game.global.fluffyPrestige2 : 0,
		},
		mod: {
			storage: 0.125,
			soldiers: 0,
			whip: $('#whipimp').checked,
			magn: $('#magnimp').checked,
			taunt: $('#tauntimp').checked,
			ven: $('#venimp').checked,
			chronojest: input('chronojest'),
			prod: input('prod'),
			loot: input('loot'),
			breed_timer: input('breed-timer'),
		}
	};

	let max_zone = game ? game.global.highestRadonLevelCleared : 999;

	return result;
}

function display(results: any) {
	let [ra_left, perks] = results;
	let perk_size = game ? game.options.menu.smallPerks.enabled : 0;
	let size = $('#perks').clientWidth / (5 + perk_size);
	$('#test-text').innerText = `Level: ${prettify(12345678)} (+${prettify(1234567)})`;
	let level_text = size > $('#test-text').clientWidth ? 'Level: ' : '';

	$('#results').style.opacity = '1';
	$('#info').innerText = localStorage.more ? 'Less info' : 'More info';
	$('#he-left').innerHTML = prettify(ra_left) + ' Radon Left Over';
	$('#perks').innerHTML = Object.keys(perks).filter(name => !perks[name].locked).map(name => {
		let {level, max_level} = perks[name];
		let diff = game ? level - game.portal[name].level : 0;
		let diff_text = diff ? ` (${diff > 0 ? '+' : '-'}${prettify(abs(diff))})` : '';
		let style = diff > 0 ? 'adding' : diff < 0 ? 'remove' : level >= max_level ? 'capped' : '';
		style += [' large', ' small', ' tiny'][perk_size];

		return `<div class='perk ${style} ${localStorage.more}'>`
			+ `<b>${name.replace('_', ' ')}</b><br>`
			+ `${level_text}<b>${prettify(level)}${diff_text}</b><br><span class=more>`
			+ `Price: ${level >= max_level ? '∞' : prettify(perks[name].cost)}<br>`
			+ `Spent: ${prettify(perks[name].spent())}</span></div>`;
	}).join('');

	for (let name in perks)
		perks[name] = perks[name].level;

	$('#perkstring').value = LZString.compressToBase64(JSON.stringify(perks));
}

document.addEventListener("DOMContentLoaded", validate_fixed, false);
document.addEventListener("DOMContentLoaded", auto_preset, false);

function main() {
	display(optimize(parse_inputs()));
}

function toggle_info() {
	localStorage.more = localStorage.more ? '' : 'more';
	$$('.perk').forEach((elem: HTMLElement) => elem.classList.toggle('more'));
	$('#info').innerText = localStorage.more ? 'Less info' : 'More info';
}

function parse_perks(fixed: string, unlocks: string) {
	const add = (x: number) => (level: number) => 1 + x * 0.01 * level;
	const mult = (x: number) => (level: number) => pow(1 + x * 0.01, level);

	let perks: {[key: string]: Perk} = {
		Greed: 		new Perk(1e10, 0,     mult(10),     40),
		Tenacity:       new Perk(5e7, 0,      mult(10),     40),
		Criticality:    new Perk(100, 0,      add(4)),
		Equality:       new Perk(1, 0,        add(10)),
		Prismal:        new Perk(1, 0,        add(1),       100),
		Overkill:       new Perk(1e6,   0,    add(500),     30),
		Resilience:     new Perk(100,   0,    mult(10)),
		Relentlessness: new Perk(75,    0,    l => 1 + 0.05 * l * (1 + 0.3 * l), 10),
		Carpentry:      new Perk(25,    0,    mult(10)),
		Artisanistry:   new Perk(15,    0,    mult(-5)),
		Range:          new Perk(1,     0,    add(1),       10),
		Agility:        new Perk(4,     0,    mult(-5),     20),
		Bait:           new Perk(4,     0,    add(100)),
		Trumps:         new Perk(3,     0,    add(20)),
		Pheromones:     new Perk(3,     0,    add(10)),
		Packrat:        new Perk(3,     0,    add(20)),
		Motivation:     new Perk(2,     0,    add(5)),
		Power:          new Perk(1,     0,    add(5)),
		Toughness:      new Perk(1,     0,    add(5)),
		Looting:        new Perk(1,     0,    add(5)),
	};

	if (!unlocks.match(/>/))
		unlocks = unlocks.replace(/(?=,|$)/g, '>0');

	for (let item of (unlocks + ',' + fixed).split(/,/).filter(x => x)) {
		let m = item.match(/(\S+) *([<=>])=?(.*)/);
		if (!m)
			throw 'Enter a list of perk levels, such as “power=42, toughness=51”.';

		let tier2 = m[1].match(/2$|II$/i);
		let name = m[1].replace(/[ _]?(2|II)/i, '').replace(/^OK/i, 'O').replace(/^Looty/i, 'L');
		let regex = new RegExp(`^${name}[a-z]*${tier2 ? '_II' : ''}$`, 'i');
		let matches = Object.keys(perks).filter(p => p.match(regex));

		if (matches.length > 1)
			throw `Ambiguous perk abbreviation: ${m[1]}.`;
		if (matches.length < 1)
			throw `Unknown perk: ${m[1]}.`;

		let level = parse_suffixes(m[3]);
		if (!isFinite(level))
			throw `Invalid number: ${m[3]}.`;

		perks[matches[0]].locked = false;
		if (m[2] != '>')
			perks[matches[0]].max_level = level;
		if (m[2] != '<')
			perks[matches[0]].min_level = level;
	}

	return perks;
}

function optimize(params: any) {
	let {total_ra, zone, scruffy, perks, weight, mod} = params;
	let ra_left = total_ra;
	let {
		Greed, Tenacity, Criticality, Equality, Prismal,
		Overkill, Resourceful, Coordinated, Siphonology, Anticipation,
		Resilience, Meditation, Relentlessness, Carpentry, Artisanistry,
		Range, Agility, Bait, Trumps, Pheromones,
		Packrat, Motivation, Power, Toughness, Looting
	} = perks;

	for (let name of ['whip', 'magn', 'taunt', 'ven'])
		mod[name] = pow(1.003, zone * 99 * 0.03 * mod[name]);

	const books = pow(1.25, zone) * pow(zone > 100 ? 1.28 : 1.2, max(zone - 59, 0));
	const base_housing = pow(1.25, 5 + min(zone / 2, 30));
	const base_income = 600 * mod.whip * books;
	const base_radon = pow(zone - 19, 2);
	const max_tiers = zone / 5 + +((zone - 1) % 10 < 5);
	const exponents = {
		cost: pow(1.069, 0.85 * (zone < 60 ? 57 : 53)),
		attack: pow(1.19, 13),
		health: pow(1.19, 14),
		block: pow(1.19, 10),
	};
	const equip_cost = {
		attack: 211 * (weight.attack + weight.health) / weight.attack,
		health: 248 * (weight.attack + weight.health) / weight.health,
		block:    5 * (weight.attack + weight.health) / weight.health,
	};

	// Number of ticks it takes to one-shot an enemy.
	function ticks() {
		return 1 + +(Agility.bonus > 0.9) + ceil(10 * Agility.bonus);
	}

	function moti() {
		return Motivation.bonus;
	}

	const looting = () => Looting.bonus;

	function gem_income() {
		let drag = moti() * mod.whip;
		let loot = looting() * mod.magn * 0.75 * 0.8;
		let chronojest = mod.chronojest * drag * loot / 30;
		return drag + loot + chronojest;
	}

	// Max population
	const trimps = () => {
		let carp = Carpentry.bonus;
		let bonus = 3 + log(base_housing * gem_income()) / log(1.4);
		let territory = Trumps.bonus * zone;
		return 10 * (base_housing * bonus + territory) * carp * mod.taunt * carp;
	};

	function income(ignore_prod?: boolean) {
		let storage = mod.storage * Packrat.bonus;
		let loot = looting() * mod.magn / ticks();
		let prod = ignore_prod ? 0 : moti() * mod.prod;
		let chronojest = mod.chronojest * 0.1 * prod * loot;
		return base_income * (prod + loot * mod.loot + chronojest) * (1 - storage) * trimps();
	}

	function equip(stat: "attack" | "health" | "block") {
		let cost = equip_cost[stat] * Artisanistry.bonus;
		let levels = 1.136;
		let tiers = log(1 + income() / cost) / log(exponents.cost);

		if (tiers > max_tiers + 0.45) {
			levels = log(1 + pow(exponents.cost, tiers - max_tiers) * 0.2) / log(1.2);
			tiers = max_tiers;
		}
		return levels * pow(exponents[stat], tiers);
	}

	// Number of buildings of a given kind that can be built with the current income.
	// cost: base cost of the buildings
	// exp: cost increase for each new level of the building
	function building(cost: number, exp: number) {
		cost *= 4;
		return log(1 + income(true) * (exp - 1) / cost) / log(exp);
	}

	// Number of zones spent in the Magma

	// function mancers() {
		// let tributes = building(10000, 1.05);
		// let mancers = log(loot * pow(1.05, tributes) / 1e62) / log(1.01);
		// return magma() ? 1 + 0.6 * (1 - pow(0.9999, mancers)) : 1;
	// }

	// Breed speed
	function breed() {
		let potency = 0.0085 * (zone >= 60 ? 0.1 : 1) * pow(1.1, floor(zone / 5));
		return potency * Pheromones.bonus * mod.ven;
	}

	// Number of Trimps sent at a time
	let group_size: number[] = [];

	for (let coord = 0; coord <= log(1 + ra_left / 500e3) / log(1.3); ++coord) {
		let ratio = 1 + 0.25 * pow(0.98, coord);
		let available_coords = zone - 1;
		let result = 1;
		for (let i = 0; i < available_coords; ++i)
			result = ceil(result * ratio);
		group_size[coord] = result;
	}

	// Strength multiplier from coordinations
	function soldiers() {
		let ratio = 1 + 0.25;
		let pop = (mod.soldiers || trimps()) / 3;
		if (mod.soldiers > 1)
			pop += 36000 * Bait.bonus;
		let unbought_coords = max(0, log(pop) / log(ratio));
		return group_size[0] * pow(1.25, -unbought_coords);
	}

	// Total attack
	function attack() {
		let attack = (0.15 + equip('attack'));
		attack *= Power.bonus;
		attack *= Range.bonus;
		attack *= scruffy.attack;
		return soldiers() * attack;
	}

	// Total survivability (accounts for health and block)
	function health() {
		let health = (0.6 + equip('health'));
		health *= Toughness.bonus * Resilience.bonus;

		// shield

		// target number of attacks to survive
		let attacks = 6;

		if (zone < 70) { // no geneticists
			// number of ticks needed to repopulate an army
			let timer = log(1 + soldiers() * breed() / Bait.bonus) / log(1 + breed());
			attacks = timer / ticks();
		}

		health /= attacks;

		return soldiers() * (health);
	}

	const xp = () => 1;
	const agility = () => 1 / Agility.bonus;
	const radon = () => base_radon * looting() + 45;
	const overkill = () => Overkill.bonus;

	const stats: {[key: string]: () => number} = { agility, radon, xp, attack, health, overkill, trimps, income };

	function score() {
		let result = 0;
		for (let i in weight) {
			if (!weight[i])
				continue;
			let stat = stats[i]();
			if (!isFinite(stat))
				throw Error(i + ' is ' + stat);
			result += weight[i] * log(stat);
		}

		return result;
	}

	function recompute_marginal_efficiencies() {
		let baseline = score();

		for (let name in perks) {
			let perk = perks[name];
			if (perk.cost_increment || !perk.levellable(ra_left))
				continue;
			perk.level_up(1);
			perk.gain = score() - baseline;
			perk.level_up(-1);
		}

	}

	function solve_quadratic_equation(a: number, b: number, c: number): number {
		let delta = b * b - 4 * a * c;
		return (-b + sqrt(delta)) / (2 * a);
	}

	function spend_ra(perk: Perk, budget: number) {
		perk.gain /= perk.log_ratio();

		if (perk.cost_increment) {
			let ratio = (1 + perk.level);
			budget *= 0.5 * ratio ** 2;
			let x = solve_quadratic_equation(perk.cost_increment / 2, perk.cost - perk.cost_increment / 2, -budget);
			ra_left -= perk.level_up(floor(max(min(x, perk.max_level - perk.level), 1, perk.level / 1e12)));
		}
		else {
			budget **= 0.5;
			do ra_left -= perk.level_up(1);
				while (perk.cost < budget && perk.level < perk.max_level)
		}

		perk.gain *= perk.log_ratio();
	}

	mod.loot *= 20.8; // TODO: check that this is correct
	weight.agility = (weight.radon + weight.attack) / 2;
	weight.overkill = 0.25 * weight.attack * (2 - pow(0.9, weight.radon / weight.attack));

	if (zone > 90 && mod.soldiers <= 1 && Bait.min_level == 0)
		Bait.max_level = 0;

	// scruffy
	scruffy.attack = [];
	let potential = log(0.003 * scruffy.xp / pow(5, scruffy.prestige) + 1) / log(4);
	for (let cap = 0; cap <= 10; ++cap) {
		let level = min(floor(potential), cap);
		let progress = level == cap ? 0 : (pow(4, potential - level) - 1) / 3;
		scruffy.attack[cap] = 1 + pow(5, scruffy.prestige) * 0.1 * (level / 2 + progress) * (level + 1);
	}

	// Minimum levels on perks
	console.time();

	for (let name in perks) {
		let perk = perks[name];
		if (perk.cost_increment)
			ra_left -= perk.level_up(perk.min_level);
		else while (perk.level < perk.min_level)
			ra_left -= perk.level_up(1);
	}

	if (ra_left < 0)
		throw (game && game.global.canRespecPerks) ?
			"You don’t have enough Helium to afford your Fixed Perks." :
			"You don’t have a respec available.";

	// Main loop
	let sorted_perks: Perk[] = Object.keys(perks).map(name => perks[name]).filter(perk => perk.levellable(ra_left));

	for (let x = 0.999; x > 1e-12; x *= x) {
		let ra_target = total_ra * x;
		recompute_marginal_efficiencies();
		sorted_perks.sort((a, b) => b.gain / b.cost - a.gain / a.cost);

		while (ra_left > ra_target && sorted_perks.length) {
			let best = sorted_perks.shift()!;
			if (!best.levellable(ra_left))
				continue;

			spend_ra(best, ra_left - ra_target);

			// sorted_perks.splice(sorted_perks.findIndex(p => p.gain / p.cost > best.gain / best.cost), 0, best);
			let i = 0;
			while (sorted_perks[i] && sorted_perks[i].gain / sorted_perks[i].cost > best.gain / best.cost)
				i++;
			sorted_perks.splice(i, 0, best);
		}
	}

	console.timeEnd();

	return [ra_left, perks];
}
