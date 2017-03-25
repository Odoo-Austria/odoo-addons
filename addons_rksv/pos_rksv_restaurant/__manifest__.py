# -*- coding: utf-8 -*-
{
    'name': 'Registrierkasse Österreich Restaurant',
    'version': '10.0.0.1',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Registrierkassenpflicht Modul für Österreich, Restaurant Erweiterung',
    'website': 'https://www.callino.at/page/rksv',
    'description': """
Registrierkasse Österreich
==================================

Erweiterung zum Basis RKSV Modul für die Restaurant Erweiterung
""",
    'author': 'Wolfgang Pichler (Callino), Wolfgang Taferner (WT-IO-IT GmbH)',
    'depends': ['pos_rksv', 'pos_restaurant'],
    'test': [
    ],
    'data': [
        'views/pos_config.xml',
        'views/templates.xml',
    ],
    'qweb': [
    ],
    'installable': True,
    'auto_install': True,
    "external_dependencies": {
        "python": [],
        "bin": []
    },
}
