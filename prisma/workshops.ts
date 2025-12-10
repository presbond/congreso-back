// prisma/workshops.ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type SeedRow = {
  id: number
  name: string
  instructor: string
  category: string
  description: string
  duration: string
  date: string
  location: string
  level: 'Principiante' | 'Intermedio' | 'Avanzado'
  // gradient, icon => sólo UI
  tools?: string[] | null
}

const SEED: SeedRow[] = [
  {
    id: 1,
    name: "Construcción de un sistema distribuido de pruebas",
    instructor: "Benjamín Guzmán",
    category: "Calidad de Software",
    description: "Diseña un sistema para ejecutar pruebas en paralelo, reduciendo tiempos y mejorando la eficiencia del ciclo de desarrollo.",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio K - Laboratorio K1",
    level: "Avanzado",
  },
  {
    id: 2,
    name: "Blockchain: más allá de las criptomonedas",
    instructor: "Diana Reynoso e Ing. Irwing Durán",
    category: "Desarrollo Backend",
    description: "Explora los fundamentos de blockchain y sus aplicaciones en contratos inteligentes y sistemas distribuidos.",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio K - Laboratorio K3",
    level: "Intermedio",
  },
  {
    id: 3,
    name: "Como crear un asistente de IA con Ollama",
    instructor: "Adolfo López Mateo",
    category: "Inteligencia Artificial",
    description: "Aprende a implementar modelos de lenguaje locales para crear asistentes inteligentes sin depender de la nube.",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio K - Laboratorio K11",
    level: "Principiante",
  },
  {
    id: 4,
    name: "Integrando IA en tu primera PWA",
    instructor: "Gustavo Andrade",
    category: "Desarrollo Web",
    description: "Combina el poder de las Progressive Web Apps con APIs de IA para crear aplicaciones web inteligentes.",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio K - Laboratorio K4",
    level: "Intermedio",
  },
  {
    id: 5,
    name: "Reparación de PC y Laptops",
    instructor: "Edgar Bravo",
    category: "Hardware y Soporte",
    description: "Diagnostica y soluciona problemas comunes de hardware en equipos de cómputo, desde el ensamblaje hasta el mantenimiento.",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio K - Laboratorio K7",
    level: "Principiante",
  },
  {
    id: 6,
    name: "Gestión del Ciber Riesgo con IA",
    instructor: "Ivan Rosales",
    category: "Ciberseguridad",
    description: "Utiliza herramientas de IA para identificar, evaluar y reducir la superficie de ataque de una organización.",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio K - Laboratorio K5",
    level: "Avanzado",
  },
  {
    id: 7,
    name: "Desarrollo de apps móviles con .NET MAUI",
    instructor: "Héctor Reyes Armenta",
    category: "Desarrollo Móvil",
    description: "Crea aplicaciones nativas para iOS y Android desde una única base de código con C# y .NET MAUI.",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio K - Laboratorio K6",
    level: "Intermedio",
  },
  {
    id: 8,
    name: "Arquitectura VRF centralizada",
    instructor: "Ing. Karina Vázquez",
    category: "Redes",
    description: "Aprende a diseñar e implementar redes escalables y seguras utilizando Virtual Routing and Forwarding (VRF).",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio K - Laboratorio K9",
    level: "Avanzado",
  },
  {
    id: 9,
    name: "Programación con Clean Architecture",
    instructor: "Natividad Terán",
    category: "Inteligencia Artificial",
    description: "Descubre cómo las librerías de IA permiten interpretar, clasificar y extraer información valiosa de grandes volúmenes de documentos de manera automatizada.",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio K - Laboratorio K10",
    level: "Avanzado",
  },
  {
    id: 10,
    name: "La forencia en los tiempos académicos",
    instructor: "Nazly Borrero",
    category: "Ciberseguridad",
    description: "Analiza técnicas de informática forense aplicadas al entorno académico para la detección y respuesta a incidentes.",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio K - Laboratorio K2",
    level: "Intermedio",
  },
  {
    id: 11,
    name: "Fibra Óptica: Fusión y Pruebas",
    instructor: "Julio Yair Román",
    category: "Redes",
    description: "Aprende de forma práctica el proceso de fusión de fibra óptica y la utilización de OTDR para la certificación de enlaces.",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio F - Medios Telemáticos",
    level: "Principiante",
  },
  {
    id: 12,
    name: "Bases de Datos con MongoDB",
    instructor: "Marisol Manica Bronca",
    category: "Bases de Datos",
    description: "Introduce los conceptos de bases de datos NoSQL y aprende a modelar, consultar y administrar datos con MongoDB.",
    duration: "4 horas",
    date: "12 y 13 de noviembre · 14:00 - 18:00",
    location: "Edificio K - Laboratorio K12",
    level: "Principiante",
  },
]

function splitLocation(loc?: string) {
  if (!loc) return { building: null as string | null, classroom: null as string | null }
  const parts = String(loc).split('-').map(p => p.trim())
  if (parts.length >= 2) return { building: parts[0], classroom: parts.slice(1).join(' - ') }
  return { building: loc, classroom: null }
}

async function ensureColumns() {
  // Crea columnas si no existen (no cambia tu schema.prisma)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "workshop"
      ADD COLUMN IF NOT EXISTS "instructor_name" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "level" VARCHAR(32),
      ADD COLUMN IF NOT EXISTS "tools" TEXT[],
      ADD COLUMN IF NOT EXISTS "category" VARCHAR(100);
  `)
}

async function truncateWorkshops() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "workshop" RESTART IDENTITY CASCADE;`)
}

async function insertSeed() {
  const rows = SEED.map((s) => {
    const { building, classroom } = splitLocation(s.location)
    return {
      name_workshop: s.name,
      descript: s.description,
      instructor_name: s.instructor,
      level: s.level,                  // guardado tal cual ('Principiante' | 'Intermedio' | 'Avanzado')
      tools: s.tools ?? null,          // TEXT[]
      category: s.category ?? null,    // VARCHAR(100)
      building,
      classroom,
      status: 'active',                // usa tu enum status_enum en BD; aquí como texto
      spots_max: 20,                   // solicitado
      spots_occupied: 0,
    }
  })

  const cols = [
    '"name_workshop"','"descript"','"instructor_name"','"level"','"tools"','"category"',
    '"building"','"classroom"','"status"','"spots_max"','"spots_occupied"'
  ].join(', ')

  const valuesSql = rows.map((_, i) => `(
    $${i*11+1}, $${i*11+2}, $${i*11+3},
    $${i*11+4}, $${i*11+5}::text[], $${i*11+6},
    $${i*11+7}, $${i*11+8},
    $${i*11+9}::status_enum, $${i*11+10}::int, $${i*11+11}::int
  )`).join(',\n')

  const params = rows.flatMap(r => [
    r.name_workshop, r.descript, r.instructor_name,
    r.level, r.tools, r.category,
    r.building, r.classroom,
    r.status, r.spots_max, r.spots_occupied
  ])

  const sql = `INSERT INTO "workshop" (${cols}) VALUES ${valuesSql};`
  await prisma.$executeRawUnsafe(sql, ...params)
}

async function main() {
  console.log('→ Asegurando columnas…')
  await ensureColumns()

  console.log('→ Vaciando tabla "workshop"…')
  await truncateWorkshops()

  console.log('→ Insertando talleres…')
  await insertSeed()

  const [{ c }] = await prisma.$queryRawUnsafe<{ c: number }[]>(`SELECT COUNT(*)::int AS c FROM "workshop";`)
  console.log('✔ Talleres insertados:', c)
}

main()
  .catch((e) => {
    console.error('❌ Error en workshops.ts:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
