# CSIT Sheet

โครงสร้างโปรเจกต์ถูกแยกเป็น Vue.js frontend และ Node.js + Express backend

```text
frontend/
  src/
    components/
    router/
    services/
    stores/
    views/
backend/
  data/
    csit-sheet.sqlite
  src/
    controllers/
    data/
      database.js
    middleware/
    repositories/
    routes/
    services/
```

## Development

```bash
npm install
npm run dev
```

Frontend: `http://127.0.0.1:5173`

Backend API: `http://127.0.0.1:8080/api`

คำสั่ง `npm run dev` จะรัน Vue frontend และ Express backend พร้อมกัน โดย backend ใช้ `node src/server.js` บน port `8080`

ข้อมูลบัญชี `USER` และ `ADMIN` ถูกเก็บใน SQLite ที่ `backend/data/csit-sheet.sqlite`

บัญชีทดลอง:

- User: `user@csitsheet.app` / `User@1234`
- Admin: `admin@csitsheet.app` / `Admin@1234`
