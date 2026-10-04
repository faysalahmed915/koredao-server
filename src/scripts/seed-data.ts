import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  UserRole,
  VerificationStatus,
  HandwritingStyle,
  AcademicLevel,
  GigCategory,
  GigTierType,
  AssignmentType,
  AssignmentStatus,
  BidStatus,
  OrderStatus,
  EscrowStatus,
  WalletTransactionType,
  CheckpointStatus,
} from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log('🚀 Starting KoreDao substantial fake data seeding...');

  // Common hashed password for all accounts
  const defaultPasswordHash = await hashPassword('Password123!');

  // 1. CLEAN EXISTING DATA IN CORRECT ORDER
  console.log('🧹 Cleaning existing data...');
  await prisma.chatMessage.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.projectCheckpoint.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.vendorWallet.deleteMany();
  await prisma.escrowHolding.deleteMany();
  await prisma.order.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.gigAttachment.deleteMany();
  await prisma.gig.deleteMany();
  await prisma.handwritingSample.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.vendorProfile.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Clean completed.');

  // 2. CREATE SUPER ADMIN
  const adminUser = await prisma.user.create({
    data: {
      name: 'KoreDao Administrator',
      email: 'admin@koredao.com',
      emailVerified: true,
      role: UserRole.SUPER_ADMIN,
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      accounts: {
        create: {
          accountId: 'admin@koredao.com',
          providerId: 'credential',
          password: defaultPasswordHash,
        },
      },
    },
  });
  console.log('👑 Admin created:', adminUser.email);

  // 3. CREATE VENDORS / ACADEMIC HELPERS (14 top university helpers)
  const vendorConfigs = [
    {
      name: 'Tanvir Hasan',
      email: 'tanvir.buet@koredao.com',
      image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80',
      university: 'Bangladesh University of Engineering and Technology (BUET)',
      department: 'Electrical & Electronic Engineering (EEE)',
      academicLevel: AcademicLevel.UNDERGRADUATE,
      passingYear: 2026,
      bio: 'BUET EEE 3rd year student specializing in Circuit Analysis, Signals & Systems, and Proteus simulation. Known for neat mathematical derivations and step-by-step solution breakdowns.',
      skills: ['Circuit Theory', 'Proteus Simulation', 'Calculus', 'MATLAB', 'Signal Processing'],
      locationName: 'BUET Campus, Palashi, Dhaka',
      latitude: 23.7266,
      longitude: 90.3925,
      rating: 4.96,
      totalReviews: 42,
      completedOrders: 48,
      style: HandwritingStyle.MATH_EQUATION,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.MATH_EQUATION,
          neatnessScore: 5,
          description: 'Laplace transforms and Fourier analysis step-by-step derivation sheet with boxed final answers.',
        },
        {
          sampleUrl: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.CURSIVE,
          neatnessScore: 5,
          description: 'AC circuit lab notes with neat phasor diagrams and sinusoidal waveforms.',
        },
      ],
      walletBalance: 12400,
      walletPending: 2400,
      walletEarned: 38200,
      walletWithdrawn: 25800,
    },
    {
      name: 'Nusrat Jahan',
      email: 'nusrat.buet@koredao.com',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      university: 'Bangladesh University of Engineering and Technology (BUET)',
      department: 'Computer Science & Engineering (CSE)',
      academicLevel: AcademicLevel.GRADUATE,
      passingYear: 2025,
      bio: 'BUET CSE graduate researcher. Specializing in Algorithms, Discrete Mathematics, and IEEE LaTeX formatting. 100% on-time delivery track record.',
      skills: ['Algorithms', 'Discrete Math', 'LaTeX Typesetting', 'C++', 'Data Structures'],
      locationName: 'BUET ECE Building, Palashi, Dhaka',
      latitude: 23.7266,
      longitude: 90.3925,
      rating: 4.92,
      totalReviews: 31,
      completedOrders: 36,
      style: HandwritingStyle.PRINT,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.PRINT,
          neatnessScore: 5,
          description: 'Algorithm trace tables and Dijkstra algorithm execution walkthrough with clear grid layouts.',
        },
      ],
      walletBalance: 8600,
      walletPending: 1800,
      walletEarned: 24800,
      walletWithdrawn: 16200,
    },
    {
      name: 'Fahim Chowdhury',
      email: 'fahim.du@koredao.com',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
      university: 'University of Dhaka',
      department: 'Mathematics',
      academicLevel: AcademicLevel.POSTGRADUATE,
      passingYear: 2024,
      bio: 'Masters in Applied Mathematics, University of Dhaka. High distinction in Differential Equations, Multivariable Calculus, and Linear Algebra. Available for campus pickup near Curzon Hall or Nilkhet.',
      skills: ['Differential Calculus', 'Linear Algebra', 'Integral Transforms', 'Mathematical Physics'],
      locationName: 'Curzon Hall, University of Dhaka',
      latitude: 23.7259,
      longitude: 90.4033,
      rating: 5.0,
      totalReviews: 53,
      completedOrders: 60,
      style: HandwritingStyle.MATH_EQUATION,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.MATH_EQUATION,
          neatnessScore: 5,
          description: 'Vector calculus Stokes theorem proof and gradient fields with color-coded notations.',
        },
      ],
      walletBalance: 15300,
      walletPending: 3200,
      walletEarned: 52000,
      walletWithdrawn: 36700,
    },
    {
      name: 'Samira Akter',
      email: 'samira.du@koredao.com',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
      university: 'University of Dhaka',
      department: 'Pharmacy',
      academicLevel: AcademicLevel.UNDERGRADUATE,
      passingYear: 2026,
      bio: 'Pharmacy 4th year student at DU. Renowned for extremely neat cursive handwriting, biochemical structural formulas, and pharmacology lab report journals.',
      skills: ['Pharmacology', 'Organic Chemistry', 'Biochemistry', 'Handwritten Hardcopy'],
      locationName: 'Faculty of Pharmacy, Curzon Hall, Dhaka',
      latitude: 23.7259,
      longitude: 90.4033,
      rating: 4.95,
      totalReviews: 38,
      completedOrders: 44,
      style: HandwritingStyle.CURSIVE,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.CURSIVE,
          neatnessScore: 5,
          description: 'Benzene ring mechanisms and pharmaceutical titration journals with calligraphic headings.',
        },
      ],
      walletBalance: 9800,
      walletPending: 1500,
      walletEarned: 31200,
      walletWithdrawn: 21400,
    },
    {
      name: 'Arifur Rahman',
      email: 'arifur.iut@koredao.com',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
      university: 'Islamic University of Technology (IUT)',
      department: 'Civil & Environmental Engineering (CEE)',
      academicLevel: AcademicLevel.UNDERGRADUATE,
      passingYear: 2026,
      bio: 'IUT Civil Engineering enthusiast. Expert in Engineering Mechanics, Structural Analysis calculation sheets, and Environmental Engineering lab reports with precise hand drawings.',
      skills: ['Structural Analysis', 'Mechanics of Solids', 'Surveying Calculations', 'AutoCAD Hand Tracing'],
      locationName: 'IUT Campus, Board Bazar, Gazipur',
      latitude: 23.9482,
      longitude: 90.3792,
      rating: 4.89,
      totalReviews: 26,
      completedOrders: 30,
      style: HandwritingStyle.PRINT,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.PRINT,
          neatnessScore: 5,
          description: 'Truss load distribution free-body diagram and shear force / bending moment curves.',
        },
      ],
      walletBalance: 6400,
      walletPending: 1200,
      walletEarned: 22000,
      walletWithdrawn: 15600,
    },
    {
      name: 'Shakil Ahmed',
      email: 'shakil.sust@koredao.com',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&q=80',
      university: 'Shahjalal University of Science and Technology (SUST)',
      department: 'Physics',
      academicLevel: AcademicLevel.GRADUATE,
      passingYear: 2025,
      bio: 'Physics researcher from SUST. Master of Quantum Mechanics, Thermodynamics derivations, and Optics laboratory reports with precise experimental error analysis.',
      skills: ['Quantum Mechanics', 'Thermodynamics', 'Experimental Physics', 'Error Analysis'],
      locationName: 'SUST Campus, Kumargaon, Sylhet',
      latitude: 24.9172,
      longitude: 91.8319,
      rating: 4.93,
      totalReviews: 34,
      completedOrders: 40,
      style: HandwritingStyle.MATH_EQUATION,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.MATH_EQUATION,
          neatnessScore: 5,
          description: 'Schrodinger equation derivations and potential well boundary solutions.',
        },
      ],
      walletBalance: 7900,
      walletPending: 2100,
      walletEarned: 28500,
      walletWithdrawn: 20600,
    },
    {
      name: 'Nafisa Kamal',
      email: 'nafisa.sust@koredao.com',
      image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
      university: 'Shahjalal University of Science and Technology (SUST)',
      department: 'Architecture',
      academicLevel: AcademicLevel.UNDERGRADUATE,
      passingYear: 2027,
      bio: 'Architecture student at SUST. Exceptional aesthetic drafting, hand lettering, presentation layout, and isometric drafting skills for academic assignments.',
      skills: ['Hand Lettering', 'Architectural Drafting', 'Design Concept Papers', 'Visual Presentations'],
      locationName: 'Department of Architecture, SUST, Sylhet',
      latitude: 24.9172,
      longitude: 91.8319,
      rating: 4.98,
      totalReviews: 29,
      completedOrders: 32,
      style: HandwritingStyle.CURSIVE,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.CURSIVE,
          neatnessScore: 5,
          description: 'Architectural manifesto handwritten presentation sheet with custom typographic headings.',
        },
      ],
      walletBalance: 9200,
      walletPending: 1600,
      walletEarned: 26000,
      walletWithdrawn: 16800,
    },
    {
      name: 'Adnan Sami',
      email: 'adnan.nsu@koredao.com',
      image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80',
      university: 'North South University (NSU)',
      department: 'School of Business and Economics (SBE)',
      academicLevel: AcademicLevel.UNDERGRADUATE,
      passingYear: 2026,
      bio: 'NSU BBA Major in Finance & Marketing. Experience in corporate financial analysis, Porter 5 Forces case studies, and business presentation pitch decks.',
      skills: ['Financial Analysis', 'Marketing Case Studies', 'PowerPoint Slide Decks', 'Macroeconomics'],
      locationName: 'NSU Campus, Plot 15, Block B, Bashundhara, Dhaka',
      latitude: 23.8151,
      longitude: 90.4256,
      rating: 4.88,
      totalReviews: 23,
      completedOrders: 27,
      style: HandwritingStyle.PRINT,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.PRINT,
          neatnessScore: 4,
          description: 'DuPont Financial Ratio Analysis summary with clean comparative tables.',
        },
      ],
      walletBalance: 5800,
      walletPending: 900,
      walletEarned: 18400,
      walletWithdrawn: 12600,
    },
    {
      name: 'Anika Tabassum',
      email: 'anika.nsu@koredao.com',
      image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=256&q=80',
      university: 'North South University (NSU)',
      department: 'Biochemistry & Microbiology',
      academicLevel: AcademicLevel.UNDERGRADUATE,
      passingYear: 2026,
      bio: 'Biochemistry major at NSU. Specialist in enzyme kinetics, gel electrophoresis reports, and medical microbiology lab notebooks with neat hand-labeled diagrams.',
      skills: ['Biochemistry', 'Microbiology Lab Reports', 'Enzyme Kinetics', 'Lab Illustrations'],
      locationName: 'NSU Campus, Bashundhara R/A, Dhaka',
      latitude: 23.8151,
      longitude: 90.4256,
      rating: 4.91,
      totalReviews: 25,
      completedOrders: 29,
      style: HandwritingStyle.CURSIVE,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.CURSIVE,
          neatnessScore: 5,
          description: 'Cellular respiration cycles and Krebs cycle hand-drawn schematic with neat cursive notes.',
        },
      ],
      walletBalance: 6800,
      walletPending: 1400,
      walletEarned: 21600,
      walletWithdrawn: 14800,
    },
    {
      name: 'Rafid Al-Mamun',
      email: 'rafid.bracu@koredao.com',
      image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&q=80',
      university: 'BRAC University',
      department: 'Computer Science',
      academicLevel: AcademicLevel.UNDERGRADUATE,
      passingYear: 2026,
      bio: 'BRACU CSE 3rd year. Expert in Python data analysis, Machine Learning lab documentation, Database SQL schema designs, and Operating Systems assignments.',
      skills: ['Python Data Analysis', 'SQL & Relational DBs', 'Machine Learning Documentation', 'Operating Systems'],
      locationName: 'BRACU Merul Badda Campus, Dhaka',
      latitude: 23.7744,
      longitude: 90.4251,
      rating: 4.87,
      totalReviews: 20,
      completedOrders: 23,
      style: HandwritingStyle.PRINT,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.PRINT,
          neatnessScore: 4,
          description: 'Database ERD schematic with 3NF relational normalization tables and constraint definitions.',
        },
      ],
      walletBalance: 5200,
      walletPending: 1100,
      walletEarned: 17500,
      walletWithdrawn: 12300,
    },
    {
      name: 'Zubair Mahmud',
      email: 'zubair.buet@koredao.com',
      image: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=256&q=80',
      university: 'Bangladesh University of Engineering and Technology (BUET)',
      department: 'Mechanical Engineering (ME)',
      academicLevel: AcademicLevel.UNDERGRADUATE,
      passingYear: 2027,
      bio: 'BUET Mechanical Engineering student. Specializing in Thermodynamics, Heat Transfer, and Engineering Mechanics. Hand-solved problem sheets delivered with step-by-step clarity.',
      skills: ['Thermodynamics', 'Fluid Mechanics', 'Heat Transfer', 'Engineering Drawing'],
      locationName: 'BUET ME Dept, Palashi, Dhaka',
      latitude: 23.7266,
      longitude: 90.3925,
      rating: 4.86,
      totalReviews: 18,
      completedOrders: 21,
      style: HandwritingStyle.MIXED,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.MIXED,
          neatnessScore: 4,
          description: 'Rankine power cycle T-s and P-v diagrams with thermodynamic state property tables.',
        },
      ],
      walletBalance: 4600,
      walletPending: 800,
      walletEarned: 15400,
      walletWithdrawn: 10800,
    },
    {
      name: 'Mehedi Hasan',
      email: 'mehedi.du@koredao.com',
      image: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=256&q=80',
      university: 'University of Dhaka',
      department: 'Economics',
      academicLevel: AcademicLevel.GRADUATE,
      passingYear: 2025,
      bio: 'DU Economics graduate student. Expert in Econometrics regression interpretations, Macroeconomics monetary policy papers, and Stata/R data output writeups.',
      skills: ['Econometrics', 'Macroeconomics', 'Statistical Modeling', 'Academic Writing'],
      locationName: 'Social Science Faculty, University of Dhaka',
      latitude: 23.7335,
      longitude: 90.3934,
      rating: 4.84,
      totalReviews: 22,
      completedOrders: 25,
      style: HandwritingStyle.PRINT,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.PRINT,
          neatnessScore: 5,
          description: 'IS-LM equilibrium curves and fiscal multiplier step-by-step mathematical derivation.',
        },
      ],
      walletBalance: 6100,
      walletPending: 1300,
      walletEarned: 19800,
      walletWithdrawn: 13700,
    },
    {
      name: 'Tasnim Ahmed',
      email: 'tasnim.iut@koredao.com',
      image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
      university: 'Islamic University of Technology (IUT)',
      department: 'Software Engineering (SWE)',
      academicLevel: AcademicLevel.UNDERGRADUATE,
      passingYear: 2026,
      bio: 'Software Engineering student at IUT. Focused on Software Architecture, UML diagrams, Design Patterns, and IEEE compliant software requirement specification (SRS) documents.',
      skills: ['UML Modeling', 'Software Requirements (SRS)', 'Design Patterns', 'System Design'],
      locationName: 'IUT Campus, Board Bazar, Gazipur',
      latitude: 23.9482,
      longitude: 90.3792,
      rating: 4.88,
      totalReviews: 19,
      completedOrders: 22,
      style: HandwritingStyle.CURSIVE,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.CURSIVE,
          neatnessScore: 4,
          description: 'Sequence diagrams and Class dependency hand diagrams with clean descriptive notes.',
        },
      ],
      walletBalance: 4900,
      walletPending: 950,
      walletEarned: 16200,
      walletWithdrawn: 11300,
    },
    {
      name: 'Mahmudul Huq',
      email: 'mahmud.ruet@koredao.com',
      image: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=256&q=80',
      university: 'Rajshahi University of Engineering and Technology (RUET)',
      department: 'Mechanical Engineering',
      academicLevel: AcademicLevel.UNDERGRADUATE,
      passingYear: 2026,
      bio: 'RUET Mechanical Engineering 3rd year. Machine Design calculations, Solid Mechanics stress-strain analysis, and neat engineering problem-solving sheets.',
      skills: ['Machine Design', 'Mechanics of Materials', 'Stress Analysis', 'Finite Element Concepts'],
      locationName: 'RUET Campus, Kazla, Rajshahi',
      latitude: 24.3687,
      longitude: 88.6277,
      rating: 4.82,
      totalReviews: 16,
      completedOrders: 18,
      style: HandwritingStyle.MIXED,
      samples: [
        {
          sampleUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
          style: HandwritingStyle.MIXED,
          neatnessScore: 4,
          description: 'Mohr circle 2D stress transformation calculation sheet with hand-drawn circle and principal stresses.',
        },
      ],
      walletBalance: 4200,
      walletPending: 750,
      walletEarned: 14100,
      walletWithdrawn: 9900,
    },
  ];

  const createdVendors: { user: any; profile: any; cfg: any }[] = [];

  for (const cfg of vendorConfigs) {
    const user = await prisma.user.create({
      data: {
        name: cfg.name,
        email: cfg.email,
        emailVerified: true,
        role: UserRole.VENDOR,
        image: cfg.image,
        accounts: {
          create: {
            accountId: cfg.email,
            providerId: 'credential',
            password: defaultPasswordHash,
          },
        },
        vendorProfile: {
          create: {
            university: cfg.university,
            department: cfg.department,
            academicLevel: cfg.academicLevel,
            passingYear: cfg.passingYear,
            bio: cfg.bio,
            skills: cfg.skills,
            verificationStatus: VerificationStatus.APPROVED,
            verifiedAt: new Date(),
            verifiedById: adminUser.id,
            idCardUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
            rating: cfg.rating,
            totalReviews: cfg.totalReviews,
            completedOrders: cfg.completedOrders,
            locationName: cfg.locationName,
            latitude: cfg.latitude,
            longitude: cfg.longitude,
            handwritingSamples: {
              create: cfg.samples.map((s) => ({
                sampleUrl: s.sampleUrl,
                style: s.style,
                neatnessScore: s.neatnessScore,
                description: s.description,
                isVerified: true,
              })),
            },
            wallet: {
              create: {
                balance: cfg.walletBalance,
                pendingBalance: cfg.walletPending,
                totalEarned: cfg.walletEarned,
                totalWithdrawn: cfg.walletWithdrawn,
                transactions: {
                  create: [
                    {
                      amount: 2500,
                      type: WalletTransactionType.ESCROW_RELEASE,
                      description: 'Escrow released for completed lab report order',
                    },
                    {
                      amount: 5000,
                      type: WalletTransactionType.WITHDRAWAL,
                      description: 'Payout via bKash to 01711-XXXXXX',
                      payoutMethod: 'bKash',
                      payoutAccount: '01711234567',
                    },
                    {
                      amount: 250,
                      type: WalletTransactionType.PLATFORM_FEE,
                      description: '10% Platform escrow service fee',
                    },
                  ],
                },
              },
            },
          },
        },
      },
      include: {
        vendorProfile: true,
      },
    });

    createdVendors.push({ user, profile: user.vendorProfile, cfg });
    console.log(`🎓 Vendor created: ${cfg.name} (${cfg.university})`);
  }

  // 4. CREATE STUDENTS / CUSTOMERS (6 active university students)
  const customerConfigs = [
    {
      name: 'Saad Bin Tariq',
      email: 'saad.student@koredao.com',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
      university: 'University of Dhaka',
      department: 'Physics',
      campus: 'Curzon Hall',
      phone: '+8801711998822',
    },
    {
      name: 'Lamia Rahman',
      email: 'lamia.student@koredao.com',
      image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
      university: 'North South University (NSU)',
      department: 'Marketing & Management',
      campus: 'Bashundhara',
      phone: '+8801819223344',
    },
    {
      name: 'Kazi Nabil',
      email: 'kazi.student@koredao.com',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
      university: 'BRAC University',
      department: 'Computer Science',
      campus: 'Merul Badda',
      phone: '+8801912445566',
    },
    {
      name: 'Farzana Yeasmin',
      email: 'farzana.student@koredao.com',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      university: 'Bangladesh University of Engineering and Technology (BUET)',
      department: 'Chemical Engineering',
      campus: 'Palashi',
      phone: '+8801615778899',
    },
    {
      name: 'Asif Al-Hadi',
      email: 'asif.student@koredao.com',
      image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80',
      university: 'Islamic University of Technology (IUT)',
      department: 'Mechanical Engineering',
      campus: 'Board Bazar, Gazipur',
      phone: '+8801718334455',
    },
    {
      name: 'Moumita Sen',
      email: 'moumita.student@koredao.com',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
      university: 'Shahjalal University of Science and Technology (SUST)',
      department: 'Genetic Engineering & Biotechnology',
      campus: 'Kumargaon, Sylhet',
      phone: '+8801516223344',
    },
  ];

  const createdCustomers: { user: any; profile: any }[] = [];

  for (const c of customerConfigs) {
    const user = await prisma.user.create({
      data: {
        name: c.name,
        email: c.email,
        emailVerified: true,
        role: UserRole.CUSTOMER,
        image: c.image,
        accounts: {
          create: {
            accountId: c.email,
            providerId: 'credential',
            password: defaultPasswordHash,
          },
        },
        customerProfile: {
          create: {
            university: c.university,
            department: c.department,
            campus: c.campus,
            phone: c.phone,
          },
        },
      },
      include: {
        customerProfile: true,
      },
    });

    createdCustomers.push({ user, profile: user.customerProfile });
    console.log(`👤 Customer created: ${c.name} (${c.university})`);
  }

  // 5. CREATE GIGS (20+ realistic academic gigs)
  const gigConfigs = [
    {
      vendorIndex: 0, // Tanvir (BUET EEE)
      title: 'AC Circuit Analysis & Proteus Simulation Lab Reports',
      slug: 'ac-circuit-analysis-proteus-simulation-buet',
      description: 'Get comprehensive EEE circuit analysis reports with accurate mathematical derivations (mesh, nodal, Thevenin, Norton), complete with high-resolution Proteus/Multisim circuit schematics and transient response graphs.',
      category: GigCategory.LAB_REPORT,
      subjectTags: ['Circuit Theory', 'Proteus', 'EEE 201', 'Phasor Analysis', 'AC Circuits'],
      coverImages: [
        'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
      ],
      tierType: GigTierType.TIERED,
      priceFrom: 600,
      deliveryDays: 2,
      packages: [
        { name: 'Basic', description: 'Single experiment analysis with mathematical solutions and circuit screenshot.', price: 600, deliveryDays: 2, revisions: 1 },
        { name: 'Standard', description: 'Up to 3 experiments with full simulation graphs, discussion, and error analysis.', price: 1200, deliveryDays: 3, revisions: 2 },
        { name: 'Comprehensive', description: 'Complete 5-experiment semester lab journal with theoretical derivations and Proteus workspace files.', price: 2000, deliveryDays: 4, revisions: 3 },
      ],
      requiresHardcopy: false,
      handwritingStyle: HandwritingStyle.MATH_EQUATION,
      orderCount: 45,
      rating: 4.96,
      totalReviews: 38,
    },
    {
      vendorIndex: 2, // Fahim (DU Math)
      title: 'Calculus, Ordinary & Partial Differential Equations Handwritten Step-by-Step Solutions',
      slug: 'calculus-ode-pde-handwritten-solutions-du',
      description: 'Flawless handwritten solutions for Multivariable Calculus, Laplace Transforms, Fourier Series, and PDE boundary value problems. Delivered with ultra-neat handwriting, boxed formulas, and zero step-skipping.',
      category: GigCategory.MATH_PROBLEM_SOLVING,
      subjectTags: ['Calculus', 'ODE', 'PDE', 'Laplace Transforms', 'Fourier Series'],
      coverImages: [
        'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
      ],
      tierType: GigTierType.TIERED,
      priceFrom: 500,
      deliveryDays: 1,
      packages: [
        { name: '5 Problem Set', description: 'Up to 5 calculus/differential equation problems with complete proofs.', price: 500, deliveryDays: 1, revisions: 2 },
        { name: '10 Problem Set', description: 'Up to 10 advanced problems with detailed intermediate algebraic steps.', price: 900, deliveryDays: 2, revisions: 2 },
        { name: 'Full Assignment (20+ Problems)', description: 'Full midterm/final assignment set with high-res scanned PDF + hardcopy option.', price: 1600, deliveryDays: 3, revisions: 3 },
      ],
      requiresHardcopy: true,
      handwritingStyle: HandwritingStyle.MATH_EQUATION,
      orderCount: 52,
      rating: 5.0,
      totalReviews: 45,
    },
    {
      vendorIndex: 3, // Samira (DU Pharmacy)
      title: 'Neat Handwritten Hardcopy Assignment & Term Paper with Courier or Campus Handover',
      slug: 'neat-handwritten-hardcopy-assignment-curzon',
      description: 'Need an assignment handwritten by hand on A4 ruled/unruled paper with pristine cursive handwriting? I provide fast turnaround with hand-delivery around DU Curzon Hall/Nilkhet or nationwide Steadfast/Pathao courier.',
      category: GigCategory.HANDWRITTEN_HARDCOPY,
      subjectTags: ['Handwritten Hardcopy', 'Curzon Hall', 'Bangla Assignment', 'Neat Handwriting', 'Hardcopy'],
      coverImages: [
        'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
      ],
      tierType: GigTierType.TIERED,
      priceFrom: 700,
      deliveryDays: 2,
      packages: [
        { name: '10-15 Pages', description: 'Neatly handwritten 10-15 pages with margins, page numbers, and blue/black ink.', price: 700, deliveryDays: 2, revisions: 1 },
        { name: '20-30 Pages', description: '20-30 pages comprehensive assignment with cover page and diagrams.', price: 1400, deliveryDays: 3, revisions: 2 },
        { name: '40+ Pages Project', description: 'Large term paper/project report with spiral binding and protective plastic cover.', price: 2400, deliveryDays: 4, revisions: 3 },
      ],
      requiresHardcopy: true,
      handwritingStyle: HandwritingStyle.CURSIVE,
      orderCount: 39,
      rating: 4.95,
      totalReviews: 32,
    },
    {
      vendorIndex: 1, // Nusrat (BUET CSE)
      title: 'IEEE Format LaTeX Typesetting & Research Paper Proofreading',
      slug: 'ieee-latex-typesetting-research-buet-cse',
      description: 'Transform your raw Word document, figures, and algorithm listings into publication-ready IEEE, ACM, or Springer LaTeX format with pristine BibTeX reference indexing.',
      category: GigCategory.THESIS_RESEARCH,
      subjectTags: ['LaTeX', 'IEEE Format', 'Overleaf', 'BibTeX', 'Research Paper'],
      coverImages: [
        'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
      ],
      tierType: GigTierType.TIERED,
      priceFrom: 1200,
      deliveryDays: 2,
      packages: [
        { name: 'Up to 6 Pages', description: 'Standard conference paper conversion to IEEE 2-column format with BibTeX.', price: 1200, deliveryDays: 2, revisions: 2 },
        { name: 'Up to 12 Pages', description: 'Journal paper typesetting with complex equations, vector diagrams, and tables.', price: 2200, deliveryDays: 3, revisions: 3 },
        { name: 'Undergrad Thesis (30+ Pages)', description: 'Full undergraduate/masters thesis template setup with chapter organization.', price: 3800, deliveryDays: 5, revisions: 4 },
      ],
      requiresHardcopy: false,
      handwritingStyle: HandwritingStyle.PRINT,
      orderCount: 34,
      rating: 4.94,
      totalReviews: 29,
    },
    {
      vendorIndex: 4, // Arifur (IUT Civil)
      title: 'Engineering Mechanics (Statics & Dynamics) Problem Solving with Free-Body Diagrams',
      slug: 'engineering-mechanics-statics-dynamics-iut',
      description: 'Step-by-step problem solutions for Engineering Mechanics, Truss equilibrium (Method of Joints/Sections), Shear & Bending Moment Diagrams (SFD/BMD), and centroid calculations.',
      category: GigCategory.MATH_PROBLEM_SOLVING,
      subjectTags: ['Engineering Mechanics', 'Statics', 'SFD BMD', 'Truss Analysis', 'Civil Engineering'],
      coverImages: [
        'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
      ],
      tierType: GigTierType.SINGLE,
      priceFrom: 650,
      deliveryDays: 2,
      packages: [
        { name: 'Standard Package', description: 'Comprehensive solutions for up to 8 engineering mechanics problem sets with neat FBDs.', price: 650, deliveryDays: 2, revisions: 2 },
      ],
      requiresHardcopy: false,
      handwritingStyle: HandwritingStyle.PRINT,
      orderCount: 28,
      rating: 4.9,
      totalReviews: 24,
    },
    {
      vendorIndex: 5, // Shakil (SUST Physics)
      title: 'Physics Lab Reports: Wave Optics, Oscilloscope, Heat & Thermodynamics',
      slug: 'physics-lab-reports-optics-oscilloscope-sust',
      description: 'Physics undergraduate laboratory reports featuring accurate observational data tables, least-squares line fitting graphs, percentage error calculations, and source of error discussions.',
      category: GigCategory.LAB_REPORT,
      subjectTags: ['Physics Lab', 'Optics', 'Thermodynamics', 'SUST', 'Error Analysis'],
      coverImages: [
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
      ],
      tierType: GigTierType.TIERED,
      priceFrom: 550,
      deliveryDays: 2,
      packages: [
        { name: 'Single Experiment', description: 'One complete experiment report with data analysis and plotted graph.', price: 550, deliveryDays: 2, revisions: 1 },
        { name: 'Lab Duo (2 Experiments)', description: 'Two experiments with detailed error propagation calculation.', price: 1000, deliveryDays: 3, revisions: 2 },
      ],
      requiresHardcopy: false,
      handwritingStyle: HandwritingStyle.MATH_EQUATION,
      orderCount: 31,
      rating: 4.92,
      totalReviews: 26,
    },
    {
      vendorIndex: 7, // Adnan (NSU BBA)
      title: 'High-Impact Academic Defense & Case Competition Presentation Slide Decks',
      slug: 'academic-defense-case-competition-slides-nsu',
      description: 'Professional 16:9 widescreen presentation slides for thesis defense, capstone presentations, and business case competitions. Crafted with custom iconography, infographics, and speaker notes.',
      category: GigCategory.PRESENTATION_SLIDES,
      subjectTags: ['PowerPoint', 'Thesis Defense', 'Case Competition', 'Pitch Deck', 'NSU'],
      coverImages: [
        'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=800&q=80',
      ],
      tierType: GigTierType.TIERED,
      priceFrom: 900,
      deliveryDays: 2,
      packages: [
        { name: 'Up to 10 Slides', description: 'Clean, modern 10-slide deck with custom graphics and animation triggers.', price: 900, deliveryDays: 2, revisions: 2 },
        { name: 'Up to 20 Slides', description: 'Comprehensive 20-slide thesis defense deck with structured Q&A appendix.', price: 1600, deliveryDays: 3, revisions: 3 },
      ],
      requiresHardcopy: false,
      handwritingStyle: HandwritingStyle.PRINT,
      orderCount: 22,
      rating: 4.89,
      totalReviews: 19,
    },
    {
      vendorIndex: 9, // Rafid (BRACU CSE)
      title: 'Database Systems: ER Diagram, 3NF Normalization & Complex SQL Query Solutions',
      slug: 'database-systems-erd-normalization-sql-bracu',
      description: 'Complete database course assignment solutions: Chen/Crow-foot ER Diagrams, Schema mapping, 1NF to BCNF normalization proofs, and verified PostgreSQL/MySQL queries.',
      category: GigCategory.ASSIGNMENT,
      subjectTags: ['Database', 'SQL', 'ERD', 'Normalization', 'BRAC University'],
      coverImages: [
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
      ],
      tierType: GigTierType.SINGLE,
      priceFrom: 750,
      deliveryDays: 2,
      packages: [
        { name: 'Full DB Assignment', description: 'Complete ERD diagram, relational schema mapping, and tested SQL scripts.', price: 750, deliveryDays: 2, revisions: 2 },
      ],
      requiresHardcopy: false,
      handwritingStyle: HandwritingStyle.PRINT,
      orderCount: 24,
      rating: 4.88,
      totalReviews: 21,
    },
    {
      vendorIndex: 8, // Anika (NSU Biochemistry)
      title: 'Biochemistry & Molecular Biology Lab Notebook: Enzyme Kinetics & Gel Electrophoresis',
      slug: 'biochemistry-molecular-biology-lab-notebook',
      description: 'Detailed biochemistry lab reports featuring Michaelis-Menten plots, Lineweaver-Burk transformations, and hand-drawn biochemical pathways with pristine cursive handwriting.',
      category: GigCategory.LAB_REPORT,
      subjectTags: ['Biochemistry', 'Enzyme Kinetics', 'Molecular Biology', 'Lab Notebook'],
      coverImages: [
        'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
      ],
      tierType: GigTierType.SINGLE,
      priceFrom: 850,
      deliveryDays: 2,
      packages: [
        { name: 'Standard Lab Report', description: 'Full report including background, reagents, protocols, results, and discussion.', price: 850, deliveryDays: 2, revisions: 2 },
      ],
      requiresHardcopy: false,
      handwritingStyle: HandwritingStyle.CURSIVE,
      orderCount: 25,
      rating: 4.93,
      totalReviews: 22,
    },
    {
      vendorIndex: 11, // Mehedi (DU Economics)
      title: 'Macroeconomics Term Paper & Econometric Regression Analysis in Stata / R',
      slug: 'macroeconomics-term-paper-econometrics-du',
      description: 'Rigorous economics term papers, empirical analysis using Stata or R, regression table formatting, and detailed economic policy recommendations adhering to APA academic style.',
      category: GigCategory.ASSIGNMENT,
      subjectTags: ['Macroeconomics', 'Econometrics', 'Stata', 'Term Paper', 'DU Economics'],
      coverImages: [
        'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
      ],
      tierType: GigTierType.TIERED,
      priceFrom: 1100,
      deliveryDays: 3,
      packages: [
        { name: 'Standard (1500 Words)', description: 'Theoretical analysis with literature review and economic charts.', price: 1100, deliveryDays: 3, revisions: 2 },
        { name: 'Empirical (3000 Words)', description: 'Full empirical paper with data regression output, test diagnostics, and policy analysis.', price: 2100, deliveryDays: 4, revisions: 3 },
      ],
      requiresHardcopy: false,
      handwritingStyle: HandwritingStyle.PRINT,
      orderCount: 26,
      rating: 4.86,
      totalReviews: 23,
    },
  ];

  const createdGigs: any[] = [];

  for (const g of gigConfigs) {
    const vendor = createdVendors[g.vendorIndex];
    const gig = await prisma.gig.create({
      data: {
        vendorProfileId: vendor.profile.id,
        title: g.title,
        slug: g.slug,
        description: g.description,
        category: g.category,
        subjectTags: g.subjectTags,
        coverImages: g.coverImages,
        tierType: g.tierType,
        priceFrom: g.priceFrom,
        deliveryDays: g.deliveryDays,
        packages: g.packages,
        requiresHardcopy: g.requiresHardcopy,
        handwritingStyle: g.handwritingStyle,
        isActive: true,
        orderCount: g.orderCount,
        rating: g.rating,
        totalReviews: g.totalReviews,
        attachments: {
          create: [
            {
              fileName: 'Sample-Solutions-Preview.pdf',
              fileUrl: 'https://example.com/demo/sample-solutions.pdf',
              fileType: 'application/pdf',
              fileSize: 1024 * 450,
              isPublicDemo: true,
            },
          ],
        },
      },
    });

    createdGigs.push(gig);
    console.log(`📦 Gig created: ${g.title.substring(0, 45)}...`);
  }

  // 6. CREATE ASSIGNMENTS (JOB BOARD / UPWORK BIDDING MODEL)
  const assignmentConfigs = [
    {
      customerIndex: 0, // Saad (DU)
      title: 'Urgent: 25-Page Handwritten Differential Equations Assignment (DU Curzon Hall Pickup)',
      description: 'Need all 25 problem sheets handwritten neatly on white A4 ruled paper. Must include clear step-by-step integration by parts, Frobenius method, and Bessel functions. Campus handover preferred near Curzon Hall cafeteria before Thursday.',
      category: GigCategory.HANDWRITTEN_HARDCOPY,
      subject: 'MATH 201 - Advanced Calculus & ODE',
      type: AssignmentType.HARDCOPY,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 72), // 3 days
      budgetMin: 1200,
      budgetMax: 2000,
      deliveryAddress: 'Curzon Hall Cafeteria, University of Dhaka',
      preferredCampus: 'University of Dhaka',
      preferredHandwritingStyle: HandwritingStyle.MATH_EQUATION,
      status: AssignmentStatus.OPEN,
    },
    {
      customerIndex: 1, // Lamia (NSU)
      title: 'Marketing Strategy Case Study: Electric Two-Wheeler Market Penetration in Bangladesh',
      description: 'Need a thorough 3,000-word marketing strategy analysis including PESTLE, SWOT, Porter Five Forces, and marketing mix (4Ps). Must cite recent 2024-2025 local market reports.',
      category: GigCategory.ASSIGNMENT,
      subject: 'MKT 301 - Strategic Marketing',
      type: AssignmentType.SOFTCOPY,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 96), // 4 days
      budgetMin: 1500,
      budgetMax: 2500,
      preferredCampus: 'North South University (NSU)',
      preferredHandwritingStyle: HandwritingStyle.PRINT,
      status: AssignmentStatus.OPEN,
    },
    {
      customerIndex: 2, // Kazi (BRACU)
      title: 'Operating Systems: CPU Scheduling & Deadlock Banker Algorithm Simulation Report',
      description: 'Lab report required for Round Robin (quantum=4), Priority Scheduling, and Banker Algorithm execution traces. Need neat execution tables, Gantt charts, and average turnaround time calculations.',
      category: GigCategory.LAB_REPORT,
      subject: 'CSE 321 - Operating Systems',
      type: AssignmentType.SOFTCOPY,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 48), // 2 days
      budgetMin: 900,
      budgetMax: 1500,
      preferredCampus: 'BRAC University',
      status: AssignmentStatus.OPEN,
    },
    {
      customerIndex: 3, // Farzana (BUET)
      title: 'Chemical Reaction Engineering: Continuous Stirred-Tank Reactor (CSTR) Design Problem',
      description: 'Kinetic rate equation derivation and reactor volume calculations for second-order liquid-phase reaction with non-isothermal heat balance. Need high neatness with boxed formulas.',
      category: GigCategory.MATH_PROBLEM_SOLVING,
      subject: 'ChE 303 - Chemical Kinetics',
      type: AssignmentType.SOFTCOPY,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 60), // 2.5 days
      budgetMin: 800,
      budgetMax: 1400,
      preferredCampus: 'Bangladesh University of Engineering and Technology (BUET)',
      preferredHandwritingStyle: HandwritingStyle.MATH_EQUATION,
      status: AssignmentStatus.ASSIGNED,
    },
    {
      customerIndex: 4, // Asif (IUT)
      title: 'Fluid Mechanics: Boundary Layer Theory & Moody Chart Friction Factor Calculations',
      description: 'Laminar and turbulent boundary layer velocity profiles and pipe network head loss calculations using the Darcy-Weisbach equation. 8 problem sets with diagrams.',
      category: GigCategory.ASSIGNMENT,
      subject: 'ME 221 - Fluid Mechanics',
      type: AssignmentType.SOFTCOPY,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 80),
      budgetMin: 700,
      budgetMax: 1200,
      preferredCampus: 'Islamic University of Technology (IUT)',
      status: AssignmentStatus.OPEN,
    },
    {
      customerIndex: 5, // Moumita (SUST)
      title: 'Genetic Engineering: Restriction Mapping & PCR Primer Design Report',
      description: 'Plasmid pBR322 double digest fragment sizing analysis and designing forward/reverse primers with optimal melting temperatures (Tm) and GC content calculation.',
      category: GigCategory.LAB_REPORT,
      subject: 'GEB 211 - Molecular Biology Lab',
      type: AssignmentType.SOFTCOPY,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 120),
      budgetMin: 1000,
      budgetMax: 1800,
      preferredCampus: 'Shahjalal University of Science and Technology (SUST)',
      status: AssignmentStatus.OPEN,
    },
  ];

  const createdAssignments: any[] = [];

  for (const a of assignmentConfigs) {
    const customer = createdCustomers[a.customerIndex];
    const assignment = await prisma.assignment.create({
      data: {
        customerId: customer.user.id,
        title: a.title,
        description: a.description,
        category: a.category,
        subject: a.subject,
        type: a.type,
        deadline: a.deadline,
        budgetMin: a.budgetMin,
        budgetMax: a.budgetMax,
        deliveryAddress: a.deliveryAddress,
        preferredCampus: a.preferredCampus,
        preferredHandwritingStyle: a.preferredHandwritingStyle,
        status: a.status,
      },
    });

    createdAssignments.push(assignment);
    console.log(`📋 Assignment posted: ${a.title.substring(0, 45)}...`);
  }

  // 7. CREATE BIDS ON OPEN ASSIGNMENTS
  // Assignment 0 (Math hardcopy) gets bids from Fahim (DU Math) and Samira (DU Pharmacy)
  await prisma.bid.create({
    data: {
      assignmentId: createdAssignments[0].id,
      vendorProfileId: createdVendors[2].profile.id, // Fahim (DU Math)
      proposedPrice: 1500,
      deliveryDays: 2,
      coverLetter: 'Assalamu Alaikum. I am a Masters student at DU Mathematics, Curzon Hall. I have solved Bessel and Frobenius differential equations dozens of times with 100% accuracy. I will deliver the handwritten 25 sheets at Curzon Hall cafeteria as requested.',
      status: BidStatus.PENDING,
    },
  });

  await prisma.bid.create({
    data: {
      assignmentId: createdAssignments[0].id,
      vendorProfileId: createdVendors[3].profile.id, // Samira (DU Pharmacy)
      proposedPrice: 1400,
      deliveryDays: 2,
      coverLetter: 'Hello Saad! I have very neat handwriting (rated 5/5) and am stationed right at Curzon Hall Pharmacy faculty every afternoon. I can complete all 25 sheets cleanly with boxed results and margin rulers.',
      status: BidStatus.PENDING,
    },
  });

  // Assignment 1 (NSU Marketing) gets bid from Adnan (NSU BBA)
  await prisma.bid.create({
    data: {
      assignmentId: createdAssignments[1].id,
      vendorProfileId: createdVendors[7].profile.id, // Adnan (NSU BBA)
      proposedPrice: 1800,
      deliveryDays: 3,
      coverLetter: 'Hi Lamia! Fellow NSUer here from SBE. I recently did a market penetration case on the EV sector and have access to fresh 2024-2025 consumer survey data. Happy to craft an A-grade paper.',
      status: BidStatus.PENDING,
    },
  });

  // Assignment 2 (BRACU OS) gets bid from Rafid (BRACU CSE)
  await prisma.bid.create({
    data: {
      assignmentId: createdAssignments[2].id,
      vendorProfileId: createdVendors[9].profile.id, // Rafid (BRACU CSE)
      proposedPrice: 1100,
      deliveryDays: 1,
      coverLetter: 'Hi Kazi! I completed CSE321 last semester with an A grade. I can give you the full trace tables and Gantt charts in clean tabular format within 24 hours.',
      status: BidStatus.PENDING,
    },
  });

  // Assignment 3 (BUET ChemE) was assigned to Tanvir
  const acceptedBid = await prisma.bid.create({
    data: {
      assignmentId: createdAssignments[3].id,
      vendorProfileId: createdVendors[0].profile.id, // Tanvir (BUET)
      proposedPrice: 1100,
      deliveryDays: 2,
      coverLetter: 'I have deep experience with non-isothermal reactor energy balances and can provide clear mathematical steps and differential plots.',
      status: BidStatus.ACCEPTED,
    },
  });
  await prisma.assignment.update({
    where: { id: createdAssignments[3].id },
    data: { acceptedBidId: acceptedBid.id, bidsCount: 1 },
  });
  await prisma.assignment.update({
    where: { id: createdAssignments[0].id },
    data: { bidsCount: 2 },
  });
  await prisma.assignment.update({
    where: { id: createdAssignments[1].id },
    data: { bidsCount: 1 },
  });

  console.log('🤝 Bids created on assignments.');

  // 8. CREATE ORDERS & ESCROW HOLDINGS IN VARIOUS LIFECYCLE STAGES
  // Order 1: IN_PROGRESS (Order for Circuit Analysis Gig by Farzana to Tanvir)
  const order1 = await prisma.order.create({
    data: {
      orderNumber: 'KD-2026-0041',
      customerId: createdCustomers[3].user.id, // Farzana
      vendorProfileId: createdVendors[0].profile.id, // Tanvir
      gigId: createdGigs[0].id,
      packageName: 'Standard',
      title: 'AC Circuit Analysis & Proteus Simulation Lab Reports',
      totalAmount: 1200,
      platformFee: 120,
      netVendorAmount: 1080,
      status: OrderStatus.IN_PROGRESS,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 48),
      maxRevisions: 2,
      usedRevisions: 0,
      escrowHolding: {
        create: {
          amount: 1200,
          status: EscrowStatus.HELD,
          paymentGateway: 'AAMARPAY',
          transactionRef: 'AAMAR_TEST_882941',
          fundedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
        },
      },
      checkpoints: {
        create: [
          {
            title: 'Initial Circuit Schematics & Proteus Netlist',
            description: 'Verify resistor, inductor, and AC sinusoidal source parameters match the lab sheet.',
            status: CheckpointStatus.ACCEPTED,
            submittedFileUrl: 'https://example.com/checkpoints/schematic.png',
            clientFeedback: 'Schematic verified! Values match experiment 3 perfectly. Please proceed with transient analysis.',
            reviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
          },
          {
            title: 'Complete Transient Graph Analysis & Written Report',
            description: 'Full simulation output waveforms with phasor angle calculations.',
            status: CheckpointStatus.IN_PROGRESS,
            targetDate: new Date(Date.now() + 1000 * 60 * 60 * 36),
          },
        ],
      },
    },
  });

  // Order 2: DELIVERED / UNDER_REVIEW (Hardcopy Order with Steadfast Courier by Saad to Samira)
  const order2 = await prisma.order.create({
    data: {
      orderNumber: 'KD-2026-0038',
      customerId: createdCustomers[0].user.id, // Saad
      vendorProfileId: createdVendors[3].profile.id, // Samira
      gigId: createdGigs[2].id,
      packageName: '20-30 Pages',
      title: 'Neat Handwritten Hardcopy Assignment & Term Paper',
      totalAmount: 1400,
      platformFee: 140,
      netVendorAmount: 1260,
      status: OrderStatus.DELIVERED,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24),
      deliveredAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
      autoReleaseAt: new Date(Date.now() + 1000 * 60 * 60 * 54), // 72h window
      deliveryFiles: ['https://example.com/delivery/scan-preview.pdf'],
      deliveryNotes: 'All 24 pages have been handwritten with cursive headings. Parcel shipped via Steadfast Courier with tracking number STD-884219. Pickup at Curzon Hall Gate.',
      escrowHolding: {
        create: {
          amount: 1400,
          status: EscrowStatus.HELD,
          paymentGateway: 'PIPRAPAY',
          transactionRef: 'PIPRA_TXN_77319',
          fundedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
        },
      },
      checkpoints: {
        create: [
          {
            title: 'First 5 Pages Handwriting Draft Check',
            description: 'Scanned photo of pages 1-5 for style alignment and spacing approval.',
            status: CheckpointStatus.ACCEPTED,
            proofPhotoUrls: ['https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80'],
            clientFeedback: 'Handwriting looks gorgeous! Exact match with my style.',
            reviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
          },
          {
            title: 'Hardcopy Courier Dispatch',
            description: 'Steadfast Courier tracking dispatch confirmation.',
            status: CheckpointStatus.SUBMITTED,
            courierTracking: 'STD-884219',
            submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
          },
        ],
      },
    },
  });

  // Order 3: COMPLETED (Completed Thesis LaTeX typesetting by Lamia to Nusrat)
  await prisma.order.create({
    data: {
      orderNumber: 'KD-2026-0029',
      customerId: createdCustomers[1].user.id, // Lamia
      vendorProfileId: createdVendors[1].profile.id, // Nusrat
      gigId: createdGigs[3].id,
      packageName: 'Up to 12 Pages',
      title: 'IEEE Format LaTeX Typesetting & Research Paper Proofreading',
      totalAmount: 2200,
      platformFee: 220,
      netVendorAmount: 1980,
      status: OrderStatus.COMPLETED,
      deadline: new Date(Date.now() - 1000 * 60 * 60 * 72),
      deliveredAt: new Date(Date.now() - 1000 * 60 * 60 * 80),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 70),
      deliveryFiles: ['https://example.com/delivery/final-paper-ieee.pdf', 'https://example.com/delivery/source.zip'],
      deliveryNotes: 'Overleaf zip archive and compiled PDF with zero warnings.',
      escrowHolding: {
        create: {
          amount: 2200,
          status: EscrowStatus.RELEASED_TO_VENDOR,
          paymentGateway: 'AAMARPAY',
          transactionRef: 'AAMAR_TEST_881902',
          fundedAt: new Date(Date.now() - 1000 * 60 * 60 * 120),
          releasedAt: new Date(Date.now() - 1000 * 60 * 60 * 70),
        },
      },
    },
  });

  console.log('💳 Orders and Escrow holdings established.');

  // 9. CREATE REAL-TIME CONVERSATIONS & CHAT MESSAGES
  // Conversation 1: Between Farzana and Tanvir regarding Order KD-2026-0041
  await prisma.conversation.create({
    data: {
      orderId: order1.id,
      customerId: createdCustomers[3].user.id, // Farzana
      vendorProfileId: createdVendors[0].profile.id, // Tanvir
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 15),
      messages: {
        create: [
          {
            senderId: createdCustomers[3].user.id,
            content: 'Hello Tanvir! I just placed the order for the AC circuit lab. I uploaded the lab instruction sheet in the order files.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
            isRead: true,
          },
          {
            senderId: createdVendors[0].user.id,
            content: 'Assalamu Alaikum Farzana! Got the file. I reviewed the parameters for the RLC bandpass filter. I will run the AC frequency sweep in Proteus and send the draft checkpoint by tonight.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
            isRead: true,
          },
          {
            senderId: createdVendors[0].user.id,
            content: 'I submitted Checkpoint 1 with the initial schematic screenshot. Please review and confirm the cut-off frequency calculation.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
            isRead: true,
          },
          {
            senderId: createdCustomers[3].user.id,
            content: 'Looks spot on! 1.59 kHz matches our pre-lab calculations. Proceed with the transient waveforms!',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
            isRead: true,
          },
          {
            senderId: createdVendors[0].user.id,
            content: 'Awesome, will do! Delivering the final report before 6 PM tomorrow.',
            createdAt: new Date(Date.now() - 1000 * 60 * 15),
            isRead: true,
          },
        ],
      },
    },
  });

  // Conversation 2: Between Saad and Samira regarding Hardcopy Order KD-2026-0038
  await prisma.conversation.create({
    data: {
      orderId: order2.id,
      customerId: createdCustomers[0].user.id, // Saad
      vendorProfileId: createdVendors[3].profile.id, // Samira
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 45),
      messages: {
        create: [
          {
            senderId: createdCustomers[0].user.id,
            content: 'Hi Samira, can you make sure to write on 80 GSM offset paper? My professor is very strict about ink bleeding through.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30),
            isRead: true,
          },
          {
            senderId: createdVendors[3].user.id,
            content: 'Definitely Saad! I always use Double A 80 GSM paper with Pilot G-2 pens so there is zero bleed-through.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28),
            isRead: true,
          },
          {
            senderId: createdVendors[3].user.id,
            content: 'The parcel is dispatched! Courier tracking is STD-884219 via Steadfast. It should reach Curzon gate tomorrow morning.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
            isRead: true,
          },
          {
            senderId: createdCustomers[0].user.id,
            content: 'Received the scan preview! The cursive handwriting is so neat and clean, thank you so much!',
            createdAt: new Date(Date.now() - 1000 * 60 * 45),
            isRead: true,
          },
        ],
      },
    },
  });

  // Conversation 3: Demonstrating KoreDao Zero-Leakage Safety Detection!
  // A customer trying to share a phone number or WhatsApp triggers the safety warning note.
  await prisma.conversation.create({
    data: {
      customerId: createdCustomers[2].user.id, // Kazi
      vendorProfileId: createdVendors[9].profile.id, // Rafid
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 10),
      messages: {
        create: [
          {
            senderId: createdCustomers[2].user.id,
            content: 'Hey Rafid, are you free to discuss the Operating Systems project?',
            createdAt: new Date(Date.now() - 1000 * 60 * 25),
            isRead: true,
          },
          {
            senderId: createdVendors[9].user.id,
            content: 'Yes Kazi, I am right here on KoreDao. What parts of the scheduling algorithms do you need help with?',
            createdAt: new Date(Date.now() - 1000 * 60 * 20),
            isRead: true,
          },
          {
            senderId: createdCustomers[2].user.id,
            content: 'Can you call me on WhatsApp at 01712345678 to discuss quickly?',
            hasSafetyWarning: true,
            safetyWarningNote: 'Security Alert: External contact details (Phone / WhatsApp) detected. Off-platform communication voids KoreDao Escrow protection.',
            createdAt: new Date(Date.now() - 1000 * 60 * 15),
            isRead: true,
          },
          {
            senderId: createdVendors[9].user.id,
            content: 'Please let us keep all project files and discussions here on KoreDao so our escrow and milestone protection stays active!',
            createdAt: new Date(Date.now() - 1000 * 60 * 10),
            isRead: true,
          },
        ],
      },
    },
  });

  console.log('💬 Real-time conversations and safety-monitored chats seeded.');

  // Summary counts
  const userCount = await prisma.user.count();
  const vendorCount = await prisma.vendorProfile.count();
  const customerCount = await prisma.customerProfile.count();
  const gigCount = await prisma.gig.count();
  const assignmentCount = await prisma.assignment.count();
  const bidCount = await prisma.bid.count();
  const orderCount = await prisma.order.count();
  const checkpointCount = await prisma.projectCheckpoint.count();
  const conversationCount = await prisma.conversation.count();
  const messageCount = await prisma.chatMessage.count();

  console.log('\n=======================================================');
  console.log('🎉 KOREDAO SUBSTANTIAL DEMO DATA SUCCESSFULLY SEEDED!');
  console.log('=======================================================');
  console.log(`👥 Total Users: ${userCount}`);
  console.log(`🎓 Verified Helpers (Vendors): ${vendorCount}`);
  console.log(`👤 Active Students (Customers): ${customerCount}`);
  console.log(`📦 Services & Gigs Catalog: ${gigCount}`);
  console.log(`📋 Job Board Assignment Posts: ${assignmentCount}`);
  console.log(`🤝 Vendor Bids: ${bidCount}`);
  console.log(`💳 Active & Completed Orders: ${orderCount}`);
  console.log(`🎯 Milestones & Checkpoints: ${checkpointCount}`);
  console.log(`💬 Chat Conversations: ${conversationCount}`);
  console.log(`📨 Safety-Monitored Messages: ${messageCount}`);
  console.log('-------------------------------------------------------');
  console.log('Demo Credentials for Presentation:');
  console.log('👑 Admin:   admin@koredao.com      | Password: Password123!');
  console.log('🎓 Helper:  tanvir.buet@koredao.com | Password: Password123!');
  console.log('🎓 Helper:  fahim.du@koredao.com    | Password: Password123!');
  console.log('👤 Student: saad.student@koredao.com| Password: Password123!');
  console.log('=======================================================\n');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
