export interface SpeciesInfo { species: string; latinName: string; hosts: string; habitat: string; peakMonths: number[]; identify: string; risk: string; severity: 'low' | 'moderate' | 'high' }
export const SPECIES: SpeciesInfo[] = [
  { species: 'Fox/badger tick', latinName: 'Ixodes canisuga', hosts: 'Dogs, foxes, badgers', habitat: 'Kennels, dog bedding, burrows and sett areas', peakMonths: [4, 5, 6, 7, 8, 9],
    identify: 'Small, reddish-brown with a darker shield behind the head. Often found in dog bedding and kennels.', risk: 'Heavy infestations can cause anaemia and skin irritation in dogs.', severity: 'moderate' },
  { species: 'Marsh tick', latinName: 'Ixodes apronophorus', hosts: 'Small mammals, waterfowl, occasionally livestock', habitat: 'Wetlands, fens and marshy ground', peakMonths: [5, 6, 7, 8],
    identify: 'Dark brown to black with pale legs. Rarely seen away from wet vegetation.', risk: 'Uncommon on pets; mainly relevant to animals grazing or walking near wetland.', severity: 'low' },
  { species: 'Passerine tick', latinName: 'Dermacentor frontalis', hosts: 'Ground-feeding birds such as thrushes and blackbirds', habitat: 'Woodland edges, gardens and hedgerows', peakMonths: [3, 4, 5, 6, 7],
    identify: 'Ornate, mottled shield. Engorged adults are much larger than other UK species.', risk: 'Mostly a bird parasite; can be carried into gardens where pets roam.', severity: 'low' },
  { species: 'Southern rodent tick', latinName: 'Ixodes acuminatus', hosts: 'Rodents, occasionally cats and dogs', habitat: 'Burrows, hedgerows and south-facing scrub', peakMonths: [4, 5, 6, 9, 10],
    identify: 'Small and slim with a long, narrow mouthpart. Hard to see on dense fur.', risk: 'Low direct risk but can bite pets that dig or hunt rodents.', severity: 'low' },
  { species: 'Tree-hole tick', latinName: 'Ixodes arboricola', hosts: 'Hole-nesting birds such as tits and owls', habitat: 'Tree cavities and bird nest boxes', peakMonths: [3, 4, 5, 6, 10, 11],
    identify: 'Small, pale brown. Typically found in nest boxes rather than on pets.', risk: 'Rare on pets; worth checking after cleaning out garden nest boxes.', severity: 'low' },
];
export const latinFor = (species: string) => SPECIES.find((s) => s.species.toLowerCase() === species.trim().toLowerCase())?.latinName;
