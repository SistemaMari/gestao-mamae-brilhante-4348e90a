// Dados de localização para o formulário de perfil
// País → Estado → Cidade (cascata)

export interface CountryData {
  label: string;
  value: string;
  states: StateData[];
}

export interface StateData {
  label: string;
  value: string;
  cities: string[];
}

const brasilStates: StateData[] = [
  { label: 'Acre', value: 'AC', cities: ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó'] },
  { label: 'Alagoas', value: 'AL', cities: ['Maceió', 'Arapiraca', 'Rio Largo', 'Palmeira dos Índios', 'União dos Palmares', 'Penedo', 'São Miguel dos Campos', 'Marechal Deodoro'] },
  { label: 'Amapá', value: 'AP', cities: ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque', 'Mazagão'] },
  { label: 'Amazonas', value: 'AM', cities: ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari', 'Tefé', 'Tabatinga', 'Maués'] },
  { label: 'Bahia', value: 'BA', cities: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Itabuna', 'Juazeiro', 'Lauro de Freitas', 'Ilhéus', 'Jequié', 'Teixeira de Freitas', 'Barreiras', 'Alagoinhas', 'Porto Seguro', 'Simões Filho', 'Paulo Afonso', 'Eunápolis', 'Santo Antônio de Jesus', 'Valença', 'Candeias', 'Guanambi'] },
  { label: 'Ceará', value: 'CE', cities: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato', 'Itapipoca', 'Maranguape', 'Iguatu', 'Quixadá', 'Canindé', 'Pacatuba', 'Aquiraz'] },
  { label: 'Distrito Federal', value: 'DF', cities: ['Brasília'] },
  { label: 'Espírito Santo', value: 'ES', cities: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim', 'Linhares', 'São Mateus', 'Colatina', 'Guarapari', 'Aracruz'] },
  { label: 'Goiás', value: 'GO', cities: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Valparaíso de Goiás', 'Trindade', 'Formosa', 'Novo Gama', 'Itumbiara', 'Senador Canedo', 'Catalão', 'Jataí', 'Planaltina'] },
  { label: 'Maranhão', value: 'MA', cities: ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias', 'Codó', 'Paço do Lumiar', 'Açailândia', 'Bacabal', 'Balsas'] },
  { label: 'Mato Grosso', value: 'MT', cities: ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Cáceres', 'Sorriso', 'Lucas do Rio Verde', 'Primavera do Leste', 'Barra do Garças'] },
  { label: 'Mato Grosso do Sul', value: 'MS', cities: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã', 'Naviraí', 'Nova Andradina', 'Aquidauana', 'Sidrolândia', 'Paranaíba'] },
  { label: 'Minas Gerais', value: 'MG', cities: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves', 'Uberaba', 'Governador Valadares', 'Ipatinga', 'Sete Lagoas', 'Divinópolis', 'Santa Luzia', 'Ibirité', 'Poços de Caldas', 'Patos de Minas', 'Teófilo Otoni', 'Pouso Alegre', 'Barbacena', 'Sabará', 'Varginha'] },
  { label: 'Pará', value: 'PA', cities: ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Castanhal', 'Parauapebas', 'Abaetetuba', 'Cametá', 'Marituba', 'Bragança', 'Tucuruí', 'Altamira', 'Barcarena'] },
  { label: 'Paraíba', value: 'PB', cities: ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa', 'Cabedelo', 'Cajazeiras', 'Guarabira', 'Sapé'] },
  { label: 'Paraná', value: 'PR', cities: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo', 'Guarapuava', 'Paranaguá', 'Araucária', 'Toledo', 'Apucarana', 'Pinhais', 'Campo Largo', 'Umuarama'] },
  { label: 'Pernambuco', value: 'PE', cities: ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista', 'Cabo de Santo Agostinho', 'Camaragibe', 'Garanhuns', 'Vitória de Santo Antão', 'Igarassu', 'São Lourenço da Mata', 'Abreu e Lima', 'Santa Cruz do Capibaribe'] },
  { label: 'Piauí', value: 'PI', cities: ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano', 'Campo Maior', 'Barras', 'União'] },
  { label: 'Rio de Janeiro', value: 'RJ', cities: ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'São João de Meriti', 'Campos dos Goytacazes', 'Petrópolis', 'Volta Redonda', 'Magé', 'Itaboraí', 'Macaé', 'Mesquita', 'Nova Friburgo', 'Barra Mansa', 'Cabo Frio', 'Nilópolis', 'Teresópolis', 'Angra dos Reis'] },
  { label: 'Rio Grande do Norte', value: 'RN', cities: ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Macaíba', 'Ceará-Mirim', 'Caicó', 'Açu', 'Currais Novos', 'São José de Mipibu'] },
  { label: 'Rio Grande do Sul', value: 'RS', cities: ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Rio Grande', 'Alvorada', 'Passo Fundo', 'Sapucaia do Sul', 'Uruguaiana', 'Santa Cruz do Sul', 'Cachoeirinha', 'Bagé', 'Bento Gonçalves', 'Erechim', 'Guaíba'] },
  { label: 'Rondônia', value: 'RO', cities: ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal', 'Rolim de Moura', 'Jaru', 'Guajará-Mirim'] },
  { label: 'Roraima', value: 'RR', cities: ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Alto Alegre', 'Pacaraima'] },
  { label: 'Santa Catarina', value: 'SC', cities: ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Chapecó', 'Criciúma', 'Itajaí', 'Jaraguá do Sul', 'Lages', 'Palhoça', 'Balneário Camboriú', 'Brusque', 'Tubarão', 'São Bento do Sul', 'Caçador', 'Concórdia', 'Navegantes', 'Rio do Sul', 'Camboriú', 'Gaspar'] },
  { label: 'São Paulo', value: 'SP', cities: ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'São José dos Campos', 'Osasco', 'Ribeirão Preto', 'Sorocaba', 'Mauá', 'São José do Rio Preto', 'Mogi das Cruzes', 'Santos', 'Diadema', 'Jundiaí', 'Piracicaba', 'Carapicuíba', 'Bauru', 'Itaquaquecetuba', 'São Vicente', 'Franca', 'Praia Grande', 'Guarujá', 'Taubaté', 'Limeira', 'Suzano', 'Taboão da Serra', 'Sumaré', 'Barueri', 'Embu das Artes', 'Indaiatuba', 'Cotia', 'Araraquara', 'Jacareí', 'Hortolândia', 'Presidente Prudente', 'Marília', 'Rio Claro', 'Americana', 'Itapevi'] },
  { label: 'Sergipe', value: 'SE', cities: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'São Cristóvão', 'Estância', 'Tobias Barreto', 'Simão Dias'] },
  { label: 'Tocantins', value: 'TO', cities: ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins', 'Colinas do Tocantins'] },
];

const usaStates: StateData[] = [
  { label: 'Alabama', value: 'AL', cities: ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa'] },
  { label: 'Alaska', value: 'AK', cities: ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan'] },
  { label: 'Arizona', value: 'AZ', cities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale'] },
  { label: 'California', value: 'CA', cities: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Fresno'] },
  { label: 'Colorado', value: 'CO', cities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder'] },
  { label: 'Connecticut', value: 'CT', cities: ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury'] },
  { label: 'Delaware', value: 'DE', cities: ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Bear'] },
  { label: 'District of Columbia', value: 'DC', cities: ['Washington'] },
  { label: 'Florida', value: 'FL', cities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale', 'St. Petersburg'] },
  { label: 'Georgia', value: 'GA', cities: ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens'] },
  { label: 'Hawaii', value: 'HI', cities: ['Honolulu', 'Pearl City', 'Hilo', 'Kailua', 'Waipahu'] },
  { label: 'Idaho', value: 'ID', cities: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello'] },
  { label: 'Illinois', value: 'IL', cities: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield'] },
  { label: 'Indiana', value: 'IN', cities: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'] },
  { label: 'Iowa', value: 'IA', cities: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City'] },
  { label: 'Kansas', value: 'KS', cities: ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka'] },
  { label: 'Kentucky', value: 'KY', cities: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington'] },
  { label: 'Louisiana', value: 'LA', cities: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'] },
  { label: 'Maine', value: 'ME', cities: ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'] },
  { label: 'Maryland', value: 'MD', cities: ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Bowie'] },
  { label: 'Massachusetts', value: 'MA', cities: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell'] },
  { label: 'Michigan', value: 'MI', cities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor'] },
  { label: 'Minnesota', value: 'MN', cities: ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth', 'Bloomington'] },
  { label: 'Mississippi', value: 'MS', cities: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi'] },
  { label: 'Missouri', value: 'MO', cities: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence'] },
  { label: 'Montana', value: 'MT', cities: ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte'] },
  { label: 'Nebraska', value: 'NE', cities: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney'] },
  { label: 'Nevada', value: 'NV', cities: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks'] },
  { label: 'New Hampshire', value: 'NH', cities: ['Manchester', 'Nashua', 'Concord', 'Derry', 'Dover'] },
  { label: 'New Jersey', value: 'NJ', cities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison'] },
  { label: 'New Mexico', value: 'NM', cities: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell'] },
  { label: 'New York', value: 'NY', cities: ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany'] },
  { label: 'North Carolina', value: 'NC', cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville'] },
  { label: 'North Dakota', value: 'ND', cities: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo'] },
  { label: 'Ohio', value: 'OH', cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'] },
  { label: 'Oklahoma', value: 'OK', cities: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond'] },
  { label: 'Oregon', value: 'OR', cities: ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro', 'Bend'] },
  { label: 'Pennsylvania', value: 'PA', cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading'] },
  { label: 'Rhode Island', value: 'RI', cities: ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence'] },
  { label: 'South Carolina', value: 'SC', cities: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Greenville'] },
  { label: 'South Dakota', value: 'SD', cities: ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown'] },
  { label: 'Tennessee', value: 'TN', cities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'] },
  { label: 'Texas', value: 'TX', cities: ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano'] },
  { label: 'Utah', value: 'UT', cities: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem'] },
  { label: 'Vermont', value: 'VT', cities: ['Burlington', 'South Burlington', 'Rutland', 'Barre', 'Montpelier'] },
  { label: 'Virginia', value: 'VA', cities: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News', 'Alexandria'] },
  { label: 'Washington', value: 'WA', cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent'] },
  { label: 'West Virginia', value: 'WV', cities: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling'] },
  { label: 'Wisconsin', value: 'WI', cities: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton'] },
  { label: 'Wyoming', value: 'WY', cities: ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs'] },
];

const spainStates: StateData[] = [
  { label: 'Andalucía', value: 'AN', cities: ['Sevilla', 'Málaga', 'Córdoba', 'Granada', 'Jerez de la Frontera', 'Almería', 'Huelva', 'Cádiz', 'Jaén'] },
  { label: 'Aragón', value: 'AR', cities: ['Zaragoza', 'Huesca', 'Teruel', 'Calatayud', 'Utebo'] },
  { label: 'Asturias', value: 'AS', cities: ['Oviedo', 'Gijón', 'Avilés', 'Siero', 'Langreo'] },
  { label: 'Islas Baleares', value: 'IB', cities: ['Palma', 'Ibiza', 'Manacor', 'Llucmajor', 'Inca'] },
  { label: 'Canarias', value: 'CN', cities: ['Las Palmas de Gran Canaria', 'Santa Cruz de Tenerife', 'San Cristóbal de La Laguna', 'Telde', 'Arona'] },
  { label: 'Cantabria', value: 'CB', cities: ['Santander', 'Torrelavega', 'Castro Urdiales', 'Camargo', 'Piélagos'] },
  { label: 'Castilla-La Mancha', value: 'CM', cities: ['Albacete', 'Talavera de la Reina', 'Toledo', 'Ciudad Real', 'Guadalajara', 'Cuenca'] },
  { label: 'Castilla y León', value: 'CL', cities: ['Valladolid', 'Burgos', 'Salamanca', 'León', 'Palencia', 'Zamora', 'Segovia', 'Ávila', 'Soria'] },
  { label: 'Cataluña', value: 'CT', cities: ['Barcelona', 'Hospitalet de Llobregat', 'Terrassa', 'Badalona', 'Sabadell', 'Tarragona', 'Lleida', 'Girona'] },
  { label: 'Comunidad Valenciana', value: 'VC', cities: ['Valencia', 'Alicante', 'Elche', 'Castellón de la Plana', 'Torrevieja', 'Orihuela'] },
  { label: 'Extremadura', value: 'EX', cities: ['Badajoz', 'Cáceres', 'Mérida', 'Plasencia', 'Don Benito'] },
  { label: 'Galicia', value: 'GA', cities: ['Vigo', 'A Coruña', 'Ourense', 'Lugo', 'Santiago de Compostela', 'Pontevedra', 'Ferrol'] },
  { label: 'Comunidad de Madrid', value: 'MD', cities: ['Madrid', 'Móstoles', 'Alcalá de Henares', 'Fuenlabrada', 'Leganés', 'Getafe', 'Alcorcón', 'Torrejón de Ardoz'] },
  { label: 'Región de Murcia', value: 'MC', cities: ['Murcia', 'Cartagena', 'Lorca', 'Molina de Segura', 'Alcantarilla'] },
  { label: 'Navarra', value: 'NC', cities: ['Pamplona', 'Tudela', 'Barañáin', 'Burlada', 'Estella'] },
  { label: 'País Vasco', value: 'PV', cities: ['Bilbao', 'Vitoria-Gasteiz', 'San Sebastián', 'Barakaldo', 'Getxo', 'Irún'] },
  { label: 'La Rioja', value: 'RI', cities: ['Logroño', 'Calahorra', 'Arnedo', 'Haro', 'Alfaro'] },
  { label: 'Ceuta', value: 'CE', cities: ['Ceuta'] },
  { label: 'Melilla', value: 'ML', cities: ['Melilla'] },
];

export const countries: CountryData[] = [
  { label: 'Brasil', value: 'Brasil', states: brasilStates },
  { label: 'Estados Unidos', value: 'Estados Unidos', states: usaStates },
  { label: 'Espanha', value: 'Espanha', states: spainStates },
  { label: 'Outro', value: 'Outro', states: [] },
];

export const especialidades = [
  'Ginecologista-Obstetra',
  'Endocrinologista',
  'Clínico Geral',
  'Médico de Família',
  'Enfermeiro(a) Obstétrica',
  'Outros',
];

export const idiomas = [
  { label: 'Português (BR)', value: 'pt-BR' },
  { label: 'English (US)', value: 'en-US' },
  { label: 'Español', value: 'es' },
];

export const identificadores = [
  { label: 'CPF', value: 'cpf' },
  { label: 'Prontuário', value: 'prontuario' },
  { label: 'Outro', value: 'outro' },
  { label: 'Nenhum', value: 'nenhum' },
];
