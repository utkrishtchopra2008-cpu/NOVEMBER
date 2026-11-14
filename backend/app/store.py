from sqlalchemy import JSON, Column, Integer, MetaData, String, Table, create_engine, select, update
from fastapi import HTTPException
from .models import Analysis

metadata = MetaData()
analyses = Table('vulnflow_analyses', metadata,
    Column('id', String, primary_key=True), Column('owner_id', String, nullable=False, index=True),
    Column('version', Integer, nullable=False), Column('data', JSON, nullable=False))


class Store:
    def __init__(self, url, demo=False):
        self.engine = create_engine(url, pool_pre_ping=True)
        if demo:
            metadata.create_all(self.engine)

    def create(self, owner, analysis):
        with self.engine.begin() as connection:
            connection.execute(analyses.insert().values(id=analysis.id, owner_id=owner, version=1, data=analysis.model_dump(mode='json')))

    def all(self, owner):
        with self.engine.connect() as connection:
            rows = connection.execute(select(analyses).where(analyses.c.owner_id == owner)).mappings().all()
        return [(Analysis.model_validate(row['data']), row['version']) for row in rows]

    def get(self, owner, id):
        with self.engine.connect() as connection:
            row = connection.execute(select(analyses).where(analyses.c.id == id, analyses.c.owner_id == owner)).mappings().first()
        if row is None:
            raise HTTPException(404, 'Analysis not found')
        return Analysis.model_validate(row['data']), row['version']

    def finding(self, owner, id):
        for analysis, version in self.all(owner):
            for finding in analysis.findings:
                if finding.id == id:
                    return analysis, version, finding
        raise HTTPException(404, 'Finding not found')

    def save(self, owner, analysis, version):
        with self.engine.begin() as connection:
            result = connection.execute(update(analyses).where(analyses.c.id == analysis.id, analyses.c.owner_id == owner, analyses.c.version == version).values(data=analysis.model_dump(mode='json'), version=version + 1))
            if result.rowcount != 1:
                raise HTTPException(409, 'Analysis changed; reload and retry your decision')
